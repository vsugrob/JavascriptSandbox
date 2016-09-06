/// <reference path="RstNode.ts" />
/// <reference path="MemberExpression.ts" />

enum AssignmentState {
	Initial = undefined,
	EvalRight = 1,
	Assign = 2,
	OnAssignDone = 3
}

class AssignmentExpression extends RstNode {
	public static get type () { return	'AssignmentExpression'; }
	public left : RstNode;
	public right : RstNode;
	public binOperator : string;
	public isValid : boolean;
	public get isCompoundAssignment () { return	this.operator !== '='; }
	public get leftIsIdentifier () { return	this.left.type === Identifier.type; }
	public precedence = 17;

	private rState : number;
	private rLeftValue : number;

	constructor ( public operator : string, left : RstNode, right : RstNode, loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.rLeftValue = RstNode.maxRegisterId++;
		this.binOperator = Runtime.builtin.substr.call ( this.operator, 0, this.operator.length - 1 );
		this.linkChild ( left, 'left' );
		this.linkChild ( right, 'right' );

		this.isValid = this.left.isLeftHandSideExpression;

		if ( this.isValid ) {
			if ( this.isCompoundAssignment ) {
				if ( this.leftIsIdentifier )
					this.onStep = this.onExecCompoundAssignIdentifier;
				else
					this.onStep = this.onExecCompoundAssignMember;
			} else {
				if ( this.leftIsIdentifier )
					this.onStep = this.onExecAssignIdentifier;
				else
					this.onStep = this.onExecAssignMember;
			}
		} else
			this.onStep = this.onExecInvalid;
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.left.visitDepthFirst ( callback );
		this.right.visitDepthFirst ( callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rState] = AssignmentState.Initial;
	}

	public onExecCompoundAssignIdentifier ( runtime : Runtime ) {
		/* Variable compound assignment operation order:
			a += d
			1. A = scope.a
			2. D = eval d
			3. V = A binOp D
			3. scope.a = V
		*/
		if ( runtime.regs [this.rState] === AssignmentState.Initial ) {
			var id = <Identifier> this.left;

			runtime.regs [this.rLeftValue] = runtime.getVar ( id.name );
			runtime.nextNode = this.right;
			runtime.regs [this.rState] = AssignmentState.Assign;
		} else if ( runtime.regs [this.rState] === AssignmentState.Assign ) {
			var rightValue = runtime.regs [this.right.rResult],
				leftValue = runtime.regs [this.rLeftValue];

			rightValue = Runtime.calcBinOp ( this.binOperator, leftValue, rightValue );

			var id = <Identifier> this.left;
			runtime.setVar ( id.name, rightValue );
			runtime.regs [this.rResult] = rightValue;
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		}
	}

	public onExecCompoundAssignMember ( runtime : Runtime ) {
		/* Property compound assignment operation order:
			o.p += d
			1. O = eval o
			2. P = eval p
			3. PS = String ( p )
			4. V = O [PS]
			5. D = eval d
			6. V = D binOp V
			7. PS = String ( p )	It's not a mistake.
			8. O [PS] = V
		*/
		if ( runtime.regs [this.rState] === AssignmentState.Initial ) {
			RstNode.setMemberExpressionPurpose ( runtime, this.left, MemberExpressionPurpose.EvalOPAndReadValue );
			runtime.nextNode = this.left;
			runtime.regs [this.rState] = AssignmentState.EvalRight;
		} else if ( runtime.regs [this.rState] === AssignmentState.EvalRight ) {
			runtime.nextNode = this.right;
			runtime.regs [this.rState] = AssignmentState.Assign;
		} else if ( runtime.regs [this.rState] === AssignmentState.Assign ) {
			var leftValue = runtime.regs [this.left.rResult],
				rightValue = runtime.regs [this.right.rResult],
				resultValue = Runtime.calcBinOp ( this.binOperator, leftValue, rightValue );

			RstNode.setMemberExpressionPurpose ( runtime, this.left, MemberExpressionPurpose.WriteValue );
			runtime.regs [this.left.rResult] = resultValue;
			runtime.nextNode = this.left;
			runtime.regs [this.rResult] = resultValue;
			runtime.regs [this.rState] = AssignmentState.OnAssignDone;
		} else if ( runtime.regs [this.rState] === AssignmentState.OnAssignDone ) {
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		}
	}

	public onExecAssignIdentifier ( runtime : Runtime ) {
		/* Variable assignment operation order:
			a = v
			1. V = eval v
			2. scope.a = V
		*/
		if ( runtime.regs [this.rState] === AssignmentState.Initial ) {
			runtime.nextNode = this.right;
			runtime.regs [this.rState] = AssignmentState.Assign;
		} else if ( runtime.regs [this.rState] === AssignmentState.Assign ) {
			var rightValue = runtime.regs [this.right.rResult],
				id = <Identifier> this.left;

			runtime.setVar ( id.name, rightValue );
			runtime.regs [this.rResult] = rightValue;
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		}
	}

	public onExecAssignMember ( runtime : Runtime ) {
		/* Property assignment operation order:
			o.p = v
			1. O = eval o
			2. P = eval p
			3. V = eval v
			4. PS = String ( P )
			5. O [PS] = V
		*/
		if ( runtime.regs [this.rState] === AssignmentState.Initial ) {
			RstNode.setMemberExpressionPurpose ( runtime, this.left, MemberExpressionPurpose.EvalOP );
			runtime.nextNode = this.left;
			runtime.regs [this.rState] = AssignmentState.EvalRight;
		} else if ( runtime.regs [this.rState] === AssignmentState.EvalRight ) {
			runtime.nextNode = this.right;
			runtime.regs [this.rState] = AssignmentState.Assign;
		} else if ( runtime.regs [this.rState] === AssignmentState.Assign ) {
			var rightValue = runtime.regs [this.right.rResult];
			RstNode.setMemberExpressionPurpose ( runtime, this.left, MemberExpressionPurpose.WriteValue );
			runtime.regs [this.left.rResult] = rightValue;
			runtime.nextNode = this.left;
			runtime.regs [this.rResult] = rightValue;
			runtime.regs [this.rState] = AssignmentState.OnAssignDone;
		} else if ( runtime.regs [this.rState] === AssignmentState.OnAssignDone ) {
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		}
	}

	public onExecInvalid ( runtime : Runtime ) {
		throw new ReferenceError ( 'Invalid left-hand side in assignment' );
	}

	public toCode () {
		if ( this.leftIsIdentifier ) {
			var varName = ( <Identifier> this.left ).name;

			if ( this.isCompoundAssignment ) {
				return	'rt.setVar ( "' + varName + '", rt.getVar ( "' + varName + '" ) ' +
					this.binOperator + ' ' + this.embrace ( this.right ) + ' )';
			} else
				return	'rt.setVar ( "' + varName + '", ' + this.embraceSequence ( this.right ) + ' )';
		} else if ( this.left.type === MemberExpression.type ) {
			// Preserve natural execution order using registers.
			var memberExpr = <MemberExpression> this.left,
				code : string;
			
			if ( this.isCompoundAssignment ) {
				code = '( ' + memberExpr.toCodeEvalOPAndReadMember () + ', ';
				code += memberExpr.toCodeWriteMember (
					'rt.regs [' + memberExpr.rResult + '] ' +
					this.binOperator + ' ' + this.embrace ( this.right )
				);
				code += ' )';
			} else
				code = memberExpr.toCodeEvalOPAndWriteMember ( this.right );
			
			return	code;
		} else /*if ( !this.isValid )*/ {
			return	'rt.throwReferenceError ( "Invalid left-hand side in assignment" )';
		}
	}
}