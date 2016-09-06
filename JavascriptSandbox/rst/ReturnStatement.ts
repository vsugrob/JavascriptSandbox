/// <reference path="RstNode.ts" />
/// <reference path="FunctionNode.ts" />

enum ReturnStatementState {
	EvalArgument = undefined,
	MakeJump = 1
}

class ReturnStatement extends RstNode {
	public static get type () { return	'ReturnStatement'; }
	public argument : RstNode;
	private jumpTarget : FunctionNode = null;

	private rState : number;

	constructor ( argument : RstNode, loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.linkChild ( argument, 'argument' );
	}

	public onTreeCompleted () {
		// Seek for jump target.
		var node = this.parent;

		while ( node !== null && !( node instanceof FunctionNode ) ) {
			node = node.parent;
		}

		if ( node === null )
			throw new Runtime.builtin.SyntaxError ( 'Illegal return statement' );

		this.jumpTarget = <FunctionNode> node;
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );

		if ( this.argument )
			this.argument.visitDepthFirst ( callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rState] = ReturnStatementState.EvalArgument;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === ReturnStatementState.EvalArgument ) {
			runtime.nextNode = this.argument;
			runtime.regs [this.rState] = ReturnStatementState.MakeJump;
		} else if ( runtime.regs [this.rState] === ReturnStatementState.MakeJump ) {
			var argValue = undefined;

			if ( this.argument !== null )
				argValue = runtime.regs [this.argument.rResult];

			runtime.regs [this.jumpTarget.rResult] = argValue;
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
			runtime.lift ( this.jumpTarget );
		}
	}

	public toCode () {
		if ( this.argument !== null )
			return	'return ' + this.argument.toCode () + ';';
		else
			return	'return;';
	}
}