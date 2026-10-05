export type Packet={type:string;payload:any;sequence:string;connectionId:string;sessionId:string|null;requestId?:string};
export function clientId(){let id=sessionStorage.getItem('clientId');if(!id){id=crypto.randomUUID();sessionStorage.setItem('clientId',id);}return id;}
export async function api(path:string,method='GET',body?:unknown,headers:Record<string,string>={}) {
  const response=await fetch(path,{method,headers:{Authorization:`Bearer ${sessionStorage.getItem('accessToken')??''}`,...(method==='GET'?{}:{'Idempotency-Key':crypto.randomUUID()}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await response.json();if(!response.ok)throw new Error(result.error?.code??'연결 오류');return result.data;
}
export class Wire {
  socket:WebSocket|null=null;connectionId='';sessionId:string|null=null;sequence=0n;received=0n;lastHeartbeat=0;closed=false;
  private reconnectCount=0;private watchdog:ReturnType<typeof setInterval>|null=null;private reconnectTimer:ReturnType<typeof setTimeout>|null=null;
  constructor(private onPacket:(packet:Packet)=>void,private onStatus:(status:string)=>void){}
  connect(){this.closed=false;const socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws/control`);this.socket=socket;
    socket.onopen=()=>{socket.send(JSON.stringify({protocolVersion:1,type:'auth',accessToken:sessionStorage.getItem('accessToken'),clientInstanceId:clientId()}));};
    socket.onmessage=e=>{let packet:Packet;try{packet=JSON.parse(e.data);}catch{return;}if(packet.type==='connection.welcome'){this.connectionId=packet.connectionId;this.sequence=0n;this.received=0n;this.reconnectCount=0;this.lastHeartbeat=Date.now();this.onStatus('연결됨');}
      if(BigInt(packet.sequence)!==this.received+1n){socket.close();return;}this.received++;if(packet.type==='heartbeat.ping'){this.lastHeartbeat=Date.now();this.send('heartbeat.pong',packet.payload);return;}this.onPacket(packet);};
    socket.onclose=e=>{this.connectionId='';this.onStatus('연결 끊김');this.onPacket({type:'connection.lost',payload:{},sequence:'0',connectionId:'',sessionId:null});if(!this.closed&&(e.code!==1008||e.reason==='heartbeat_timeout')&&this.reconnectCount<4){const delay=[500,1000,2000,5000][this.reconnectCount++];this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null;if(!this.closed)this.connect();},delay);}};
    if(!this.watchdog)this.watchdog=setInterval(()=>{if(this.socket?.readyState===1&&this.lastHeartbeat&&Date.now()-this.lastHeartbeat>3000){this.onPacket({type:'connection.lost',payload:{},sequence:'0',connectionId:'',sessionId:null});this.socket.close();}},1000);
  }
  send(type:string,payload:unknown,requestId?:string){if(this.socket?.readyState!==1||!this.connectionId)throw new Error('연결되지 않았어');if(this.socket.bufferedAmount>262144){this.socket.close();throw new Error('연결 적체');}this.socket.send(JSON.stringify({protocolVersion:1,messageId:crypto.randomUUID(),connectionId:this.connectionId,sessionId:this.sessionId,sequence:(++this.sequence).toString(),type,payload,...(requestId?{requestId}:{})}));}
  subscribe(id:string|null){this.sessionId=id;this.send('session.subscribe',{sessionId:id});}
  close(){this.closed=true;if(this.reconnectTimer)clearTimeout(this.reconnectTimer);this.reconnectTimer=null;this.socket?.close();if(this.watchdog)clearInterval(this.watchdog);this.watchdog=null;}
}
