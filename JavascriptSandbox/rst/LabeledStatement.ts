/// <reference path="RstNode.ts" />

class LabeledStatement extends RstNode {
	public static get type () { return	'LabeledStatement'; }
	public label : Identifier;
	public body : RstNode;

	constructor ( label : Identifier, body : RstNode, loc? : SourceLocation ) {
		super ( loc );
		this.linkChild ( label, 'label' );
		this.linkChild ( body, 'body' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.label.visitDepthFirst ( callback );
		this.body.visitDepthFirst ( callback );
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rNodeState] === RstNodeState.Initialized ) {
			runtime.nextNode = this.body;
			runtime.regs [this.rNodeState] = RstNodeState.Working;
		} else if ( runtime.regs [this.rNodeState] === RstNodeState.Working ) {
			runtime.regs [this.rResult] = runtime.regs [this.body.rResult];
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		}
	}

	public toCode () {
		return	this.label.name + ': ' + this.body.toCode ();
	}
}