import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {Wire} from '../apps/studio/src/wire.ts';

class Socket {
  static instances:Socket[]=[];
  readyState=1;bufferedAmount=0;
  onopen:(()=>void)|null=null;onmessage:((e:any)=>void)|null=null;onclose:((e:any)=>void)|null=null;
  constructor(){Socket.instances.push(this);}
  close(code=1000,reason=''){this.readyState=3;this.onclose?.({code,reason});}
  send(){}
}
let wire:Wire;
beforeEach(()=>{vi.useFakeTimers();Socket.instances=[];vi.stubGlobal('WebSocket',Socket);vi.stubGlobal('location',{protocol:'http:',host:'127.0.0.1:3001'});wire=new Wire(()=>{},()=>{});wire.connect();});
afterEach(()=>{wire.close();vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});
it('A01 heartbeat timeout retries after the existing 500ms backoff',()=>{
 Socket.instances[0]!.close(1008,'heartbeat_timeout');vi.advanceTimersByTime(499);expect(Socket.instances).toHaveLength(1);vi.advanceTimersByTime(1);expect(Socket.instances).toHaveLength(2);
});
it('A02 explicit close cancels a pending heartbeat reconnect',()=>{
 Socket.instances[0]!.close(1008,'heartbeat_timeout');wire.close();vi.advanceTimersByTime(10000);expect(Socket.instances).toHaveLength(1);expect(wire.closed).toBe(true);
});
it('A02 an already queued reconnect callback cannot reopen an explicitly closed Wire',()=>{
 const timeout=vi.spyOn(globalThis,'setTimeout');Socket.instances[0]!.close(1008,'heartbeat_timeout');const reconnect=timeout.mock.calls.find(call=>call[1]===500)![0] as ()=>void;
 try{wire.close();reconnect();expect(Socket.instances).toHaveLength(1);expect(wire.closed).toBe(true);}finally{timeout.mockRestore();}
});
it.each(['unauthenticated','token_expired','auth_timeout','invalid_sequence','invalid_message','forbidden','backpressure',''])('A01 policy close %s does not retry',reason=>{
 Socket.instances[0]!.close(1008,reason);vi.advanceTimersByTime(10000);expect(Socket.instances).toHaveLength(1);
});
