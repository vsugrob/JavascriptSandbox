/// <reference path="RstNode.ts" />

enum LogicalExpressionState {
	EvalLeft = undefined,
	EvalRight = 1,
	Calculate = 2
}

class LogicalExpression extends RstNode {
	public static get type () { return	'LogicalExpression'; }
	public left : RstNode;
	public right : RstNode;
	public get precedence () {
		switch ( this.operator ) {
		case '&&': return	13;
		case '||': return	14;
		default: throw new Runtime.builtin.Error ( 'Invalid operation "' + this.operator + '"' );
		}
	}

	private rState : number;

	constructor ( public operator : string, left : RstNode, right : RstNode, loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.linkChild ( left, 'left' );
		this.linkChild ( right, 'right' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.left.visitDepthFirst ( callback );
		this.right.visitDepthFirst ( callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rState] = LogicalExpressionState.EvalLeft;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === LogicalExpressionState.EvalLeft ) {
			runtime.nextNode = this.left;
			runtime.regs [this.rState] = LogicalExpressionState.EvalRight;
		} else if ( runtime.regs [this.rState] === LogicalExpressionState.EvalRight ) {
			var leftValue = runtime.regs [this.left.rResult],
				boolValue = !!leftValue;
			
			if ( ( this.operator === '&&' && boolValue === false ) ||
				 ( this.operator === '||' && boolValue === true ) )
			{
				runtime.regs [this.rResult] = leftValue;
				runtime.regs [this.rNodeState] = RstNodeState.Finished;
			} else {
				runtime.nextNode = this.right;
				runtime.regs [this.rState] = LogicalExpressionState.Calculate;
			}
		} else if ( runtime.regs [this.rState] === LogicalExpressionState.Calculate ) {
			var rightValue = runtime.regs [this.right.rResult];

			runtime.regs [this.rResult] = rightValue;
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		}
	}

	public toCode () {
		return	this.embrace ( this.left ) + ' ' + this.operator + ' ' + this.embrace ( this.right );
	}
}