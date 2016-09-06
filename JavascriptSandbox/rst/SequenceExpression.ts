/// <reference path="RstNode.ts" />

class SequenceExpression extends RstNode {
	public static get type () { return	'SequenceExpression'; }
	public expressions : RstNode [];
	public precedence = 18;

	private rExpressionIdx : number;

	constructor ( expressions : RstNode [] = [], loc? : SourceLocation ) {
		super ( loc );
		this.rExpressionIdx = RstNode.maxRegisterId++;
		this.linkChildren ( expressions, 'expressions' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		RstNode.visitNodeArrayDepthFirst ( this.expressions, callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rExpressionIdx] = 0;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rExpressionIdx] >= this.expressions.length ) {
			// this.expressions is never empty, so last expression always exists.
			var lastExpression = this.expressions [this.expressions.length - 1];
			runtime.regs [this.rResult] = runtime.regs [lastExpression.rResult];
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		} else
			runtime.nextNode = this.expressions [runtime.regs [this.rExpressionIdx]++];
	}

	public toCode () {
		var eCode = [];

		for ( var i = 0 ; i < this.expressions.length ; i++ ) {
			Runtime.builtin.push.call ( eCode, this.expressions [i].toCode () );
		}

		return	'( ' + Runtime.builtin.join.call ( eCode, ', ' ) + ' )';
	}
}