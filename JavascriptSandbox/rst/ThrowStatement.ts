/// <reference path="RstNode.ts" />

enum ThrowStatementState {
	EvalArgument = undefined,
	PropagateException = 1
}

class ThrowStatement extends RstNode {
	public static get type () { return	'ThrowStatement'; }
	public argument : RstNode;

	private rState : number;

	constructor ( argument : RstNode, loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.linkChild ( argument, 'argument' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.argument.visitDepthFirst ( callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rState] = ThrowStatementState.EvalArgument;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === ThrowStatementState.EvalArgument ) {
			runtime.nextNode = this.argument;
			runtime.regs [this.rState] = ThrowStatementState.PropagateException;
		} else if ( runtime.regs [this.rState] === ThrowStatementState.PropagateException ) {
			var argValue = runtime.regs [this.argument.rResult];
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
			
			throw argValue;
		}
	}

	public toCode () {
		return	'throw ' + this.argument.toCode () + ';';
	}
}