/// <reference path="RstNode.ts" />

class ExpressionStatement extends RstNode {
	public static get type () { return	'ExpressionStatement'; }
	public expression : RstNode;

	constructor ( expression : RstNode, loc? : SourceLocation ) {
		super ( loc );
		this.linkChild ( expression, 'expression' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.expression.visitDepthFirst ( callback );
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rNodeState] === RstNodeState.Initialized ) {
			runtime.nextNode = this.expression;
			runtime.regs [this.rNodeState] = RstNodeState.Working;
		} else if ( runtime.regs [this.rNodeState] === RstNodeState.Working ) {
			var exprResult = runtime.regs [this.expression.rResult];
			runtime.regs [this.rResult] = exprResult;
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
			runtime.lr = exprResult;
		}
	}

	public toCode () {
		return	'rt.lr = ' + this.expression.toCode () + ';';
	}
}