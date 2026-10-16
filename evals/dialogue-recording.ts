// Serialize complete snapshots, including callbacks after a logical timeout.
export class DialogueRecording {
  private pending:Promise<void>=Promise.resolve();
  private failure:unknown;
  constructor(private write:(snapshot:string)=>Promise<void>) {}
  save(report:object):Promise<void>{
    const snapshot=JSON.stringify(report,null,2);
    const next=this.pending.then(()=>this.write(snapshot));
    this.pending=next.catch(error=>{this.failure??=error;});
    return next;
  }
  async flush(){await this.pending;if(this.failure)throw this.failure;}
}
