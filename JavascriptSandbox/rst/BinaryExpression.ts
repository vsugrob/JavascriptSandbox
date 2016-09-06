/// <reference path="RstNode.ts" />

enum BinaryExpressionState {
	EvalLeft = undefined,
	EvalRight = 1,
	Calculate = 2
}

class BinaryExpression extends RstNode {
	public static get type () { return	'BinaryExpression'; }
	public left : RstNode;
	public right : RstNode;
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
		runtime.regs [this.rState] = BinaryExpressionState.EvalLeft;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === BinaryExpressionState.EvalLeft ) {
			runtime.nextNode = this.left;
			runtime.regs [this.rState] = BinaryExpressionState.EvalRight;
		} else if ( runtime.regs [this.rState] === BinaryExpressionState.EvalRight ) {
			runtime.nextNode = this.right;
			runtime.regs [this.rState] = BinaryExpressionState.Calculate;
		} else if ( runtime.regs [this.rState] === BinaryExpressionState.Calculate ) {
			var leftValue = runtime.regs [this.left.rResult],
				rightValue = runtime.regs [this.right.rResult],
				result = Runtime.calcBinOp ( this.operator, leftValue, rightValue );
			
			runtime.regs [this.rResult] = result;
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		}
	}

	public toCode () {
		if ( this.operator === 'in' ) {
			return	'rt.calcInOp ( ' +
				this.embraceSequence ( this.left ) + ', ' +
				this.embraceSequence ( this.right ) +
			' )';
		} else
			return	this.embrace ( this.left ) + ' ' + this.operator + ' ' + this.embrace ( this.right );
	}

	public get precedence () {
		switch ( this.operator ) {
		case '*':
		case '/':
		case '%':
			return	5;
		case '+':
		case '-':
			return	6;
		case '<<':
		case '>>':
		case '>>>':
			return	7;
		case '<':
		case '<=':
		case '>':
		case '>=':
		case 'in':
		case 'instanceof':
			return	8;
		case '==':
		case '!=':
		case '===':
		case '!==':
			return	9;
		case '&': return	10;
		case '^': return	11;
		case '|': return	12;
		default: throw new Runtime.builtin.Error ( 'Invalid operation "' + this.operator + '"' );
		}
	}
}