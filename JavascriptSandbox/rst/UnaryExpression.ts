/// <reference path="RstNode.ts" />

class UnaryExpression extends RstNode {
	public static get type () { return	'UnaryExpression'; }
	public argument : RstNode;
	public precedence = 4;

	private rState : number;

	constructor ( public operator : string, argument : RstNode, loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.linkChild ( argument, 'argument' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.argument.visitDepthFirst ( callback );
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rNodeState] === RstNodeState.Initialized ) {
			if ( this.operator === 'delete' )
				RstNode.setMemberExpressionPurpose ( runtime, this.argument, MemberExpressionPurpose.EvalOP );

			runtime.nextNode = this.argument;
			runtime.regs [this.rNodeState] = RstNodeState.Working;
		} else if ( runtime.regs [this.rNodeState] === RstNodeState.Working ) {
			var result = undefined;

			if ( this.operator === 'typeof' ) {
				if ( this.argument.type === Identifier.type ) {
					var idNode = <Identifier> this.argument;
					result = runtime.typeofVar ( idNode.name );
				} else {
					result = runtime.regs [this.argument.rResult];
					result = typeof result;
				}
			} else if ( this.operator === 'delete' ) {
				if ( this.argument.type === Identifier.type ) {
					var idNode = <Identifier> this.argument;
					result = runtime.deleteVar ( idNode.name );
				} else if ( this.argument.type === MemberExpression.type ) {
					var memberExpr = <MemberExpression> this.argument,
						o = runtime.regs [memberExpr.object.rResult],
						p = runtime.regs [memberExpr.property.rResult];

					result = runtime.deleteMember ( o, p );
				} else
					result = true;
			} else if ( this.operator !== 'void' ) {
				result = runtime.regs [this.argument.rResult];

					 if ( this.operator === '+' ) result = +result;
				else if ( this.operator === '-' ) result = -result;
				else if ( this.operator === '!' ) result = !result;
				else if ( this.operator === '~' ) result = ~result;
				else throw new Runtime.builtin.Error ( 'Invalid operation "' + this.operator + '"' );
			}

			runtime.regs [this.rResult] = result;
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		}
	}

	public toCode () {
		if ( this.operator === 'delete' ) {
			if ( this.argument.type === Identifier.type )
				return	'rt.deleteVar ( ' + this.argument.toCode () + ' )';
			else if ( this.argument.type === MemberExpression.type ) {
				var memberExpr = <MemberExpression> this.argument;
				
				return	'rt.deleteMember ( ' +
					this.embraceSequence ( memberExpr.object ) + ', ' +
					memberExpr.property.toCode () +
				' )';
			}
		} else if ( this.operator === 'typeof' && this.argument.type === Identifier.type )
			return	'rt.typeofVar ( ' + this.argument.toCode () + ' )';

		var op = this.operator;

		if ( op === 'typeof' || op === 'delete' || op === 'void' )
			op += ' ';

		return	op + this.embrace ( this.argument );
	}
}