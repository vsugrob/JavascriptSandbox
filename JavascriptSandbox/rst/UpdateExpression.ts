/// <reference path="RstNode.ts" />
/// <reference path="MemberExpression.ts" />

enum UpdateState {
	EvalArgument = undefined,
	Update = 1,
	OnUpdateDone = 2
}

class UpdateExpression extends RstNode {
	public static get type () { return	'UpdateExpression'; }
	public argument : RstNode;
	public isValid : boolean;
	public get argumentIsIdentifier () { return	this.argument.type === Identifier.type; }
	public precedence = 3;

	private rState : number;

	constructor ( public operator : string, argument : RstNode, public prefix : boolean, loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.linkChild ( argument, 'argument' );
		this.isValid = this.argument.isLeftHandSideExpression;
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.argument.visitDepthFirst ( callback );
	}

	public onEnter ( runtime : Runtime ) {
		if ( !this.isValid ) {
			// Throw even before evaluating this.argument for read.
			runtime.throwInvalidLHSInUpdate ( this.prefix );
		}

		runtime.regs [this.rState] = UpdateState.EvalArgument;
	}

	public onStep ( runtime : Runtime ) {
		if ( this.argumentIsIdentifier ) {
			var id = <Identifier> this.argument,
				resValue = runtime.updateVar ( id.name, this.operator, this.prefix );

			runtime.regs [this.rResult] = resValue;
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		} else /*if ( this.argument.type === MemberExpression.type )*/ {
			/* Property compound assignment operation order:
				o.p++
				1. O = eval o
				2. P = eval p
				3. PS = String ( p )
				4. V = O [PS]
				5. V = update V
				6. PS = String ( p )	It's not a mistake.
				7. O [PS] = V
			*/
			if ( runtime.regs [this.rState] === UpdateState.EvalArgument ) {
				RstNode.setMemberExpressionPurpose ( runtime, this.argument, MemberExpressionPurpose.EvalOPAndReadValue );
				runtime.nextNode = this.argument;
				runtime.regs [this.rState] = UpdateState.Update;
			} else if ( runtime.regs [this.rState] === UpdateState.Update ) {
				var value = runtime.regs [this.argument.rResult],
					updRes = Runtime.calcUpdate ( this.operator, value, this.prefix );
				
				RstNode.setMemberExpressionPurpose ( runtime, this.argument, MemberExpressionPurpose.WriteValue );
				runtime.regs [this.argument.rResult] = updRes.updatedValue;
				runtime.nextNode = this.argument;
				runtime.regs [this.rResult] = updRes.result;
				runtime.regs [this.rState] = UpdateState.OnUpdateDone;
			} else if ( runtime.regs [this.rState] === UpdateState.OnUpdateDone ) {
				runtime.regs [this.rNodeState] = RstNodeState.Finished;
			}
		}
	}

	public toCode () {
		if ( this.argumentIsIdentifier ) {
			var varName = ( <Identifier> this.argument ).name;

			return	'rt.updateVar ( "' + varName + '", "' + this.operator + '", ' + this.prefix + ' )';
		} else if ( this.argument.type === MemberExpression.type ) {
			// Preserve natural execution order using registers.
			var memberExpr = <MemberExpression> this.argument,
				memberExprResCode = 'rt.regs [' + memberExpr.rResult + ']',
				updExprResCode = 'rt.regs [' + this.rResult + ']',
				code = '( ' + memberExpr.toCodeEvalOPAndReadMember () + ', ' +
					updExprResCode + ' = ';

			if ( this.prefix )
				code += this.operator + memberExprResCode;
			else
				code += memberExprResCode + this.operator;

			code += ', ' + memberExpr.toCodeWriteMember ( memberExprResCode ) + ', ' +
				updExprResCode + 
				' )';

			return	code;
		} else if ( !this.isValid ) {
			return	'rt.throwInvalidLHSInUpdate ( ' + !!this.prefix + ' );';
		}
	}
}