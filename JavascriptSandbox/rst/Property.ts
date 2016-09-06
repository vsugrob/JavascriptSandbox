/// <reference path="RstNode.ts" />

enum PropertyState {
	EvalKey = undefined,
	EvalValue = 1,
	Finish = 2
}

class Property extends RstNode {
	public static get type () { return	'Property'; }
	public key : RstNode;
	public value : RstNode;
	private rState : number;

	constructor ( public kind : string, key : RstNode, value : RstNode, loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.linkChild ( key, 'key' );
		this.linkChild ( value, 'value' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.key.visitDepthFirst ( callback );
		this.value.visitDepthFirst ( callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rState] = PropertyState.EvalKey;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === PropertyState.EvalKey ) {
			runtime.nextNode = this.key;
			runtime.regs [this.rState] = PropertyState.EvalValue;
		} else if ( runtime.regs [this.rState] === PropertyState.EvalValue ) {
			runtime.nextNode = this.value;
			runtime.regs [this.rState] = PropertyState.Finish;
		} else if ( runtime.regs [this.rState] === PropertyState.Finish ) {
			runtime.regs [this.rResult] = undefined;
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		}
	}

	public toCode () {
		if ( this.kind === 'init' )
			return	this.key.toCode () + ' : ' + this.value.toCode ();
		else
			return	'';	// get and set properties coded by ObjectExpression.
	}
}