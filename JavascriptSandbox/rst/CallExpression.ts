/// <reference path="InvocationNode.ts" />

enum CallExpressionState {
	ValidateCallSite = undefined,
	ReadCallee = 1
}

class CallExpression extends InvocationNode {
	public static get type () { return	'CallExpression'; }
	public get isMemberCall () { return	this.callee.type === MemberExpression.type; }
	public precedence = 2;

	private rSubState : number;

	constructor ( callee : RstNode, args : RstNode [] = [], loc? : SourceLocation ) {
		super ( callee, args, loc );
		this.rSubState = RstNode.maxRegisterId++;
	}

	public onEnter ( runtime : Runtime ) {
		super.onEnter ( runtime );
		runtime.regs [this.rSubState] = CallExpressionState.ValidateCallSite;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === InvocationNodeState.EvalCallee ) {
			RstNode.setMemberExpressionPurpose ( runtime, this.callee, MemberExpressionPurpose.EvalOP );
			super.onStep ( runtime );
		} else if ( runtime.regs [this.rState] === InvocationNodeState.EvalArguments ) {
			if ( this.isMemberCall && runtime.regs [this.rArgumentIdx] === 0 ) {
				var memberExpr = <MemberExpression> this.callee,
					o = runtime.regs [memberExpr.object.rResult],
					p = runtime.regs [memberExpr.property.rResult];

				CallExpression.validateCalleeObject ( o, p );
			}

			super.onStep ( runtime );
		} else if ( runtime.regs [this.rState] === InvocationNodeState.PrepareInvocation ) {
			var thisObj : any,
				funcInstance : Function;

			if ( this.isMemberCall ) {
				var memberExpr = <MemberExpression> this.callee,
					o = runtime.regs [memberExpr.object.rResult],
					p = runtime.regs [memberExpr.property.rResult];

				if ( runtime.regs [this.rSubState] === CallExpressionState.ValidateCallSite ) {
					p = Runtime.builtin.String ( p );
					/* Write string representation of p back because otherwise
					 * there will be two conversions of p to string: one here and
					 * one in Runtime.readMember () called from MemberExpression.readValue (). */
					runtime.regs [memberExpr.property.rResult] = p;
					CallExpression.verifyCalleeMethodExists ( o, p );

					RstNode.setMemberExpressionPurpose ( runtime, this.callee, MemberExpressionPurpose.ReadValue );
					runtime.nextNode = this.callee;
					runtime.regs [this.rSubState] = CallExpressionState.ReadCallee;

					return;
				} else if ( runtime.regs [this.rSubState] === CallExpressionState.ReadCallee ) {
					funcInstance = runtime.regs [this.callee.rResult];
					CallExpression.validateCalleeMethod ( o, p, funcInstance );
					thisObj = o;
				}
			} else {
				funcInstance = runtime.regs [this.callee.rResult];
				InvocationNode.verifyCalleeFunction ( funcInstance );
				thisObj = undefined;

				if ( this.callee.type === Identifier.type ) {
					var idNode = <Identifier> this.callee,
						varScope = <RuntimeScope> runtime.regs [idNode.rScope];

					if ( varScope.kind === ScopeKind.WithStatement )
						thisObj = varScope.vars;
				}
			}

			runtime.regs [this.rInvocationData] = {
				funcInstance : funcInstance,
				thisObj : thisObj,
				args : null
			};
			runtime.regs [this.rState] = InvocationNodeState.MakeInvocation;
		} else
			super.onStep ( runtime );
	}

	public static validateCalleeObject ( o : any, p : string ) {
		if ( o == null ) {
			throw new Runtime.builtin.TypeError (
				'Cannot call method "' + Runtime.exceptionFreeToString ( p ) +
				'" of ' + Runtime.exceptionFreeToString ( o )
			);
		}
	}

	public static verifyCalleeMethodExists ( o : any, p : string ) {
		o = Runtime.boxValue ( o );
		
		if ( !( p in o ) || p === '__proto__' ) {
			throw new Runtime.builtin.TypeError (
				'Object ' + Runtime.exceptionFreeToString ( o ) +
				' has no method "' + Runtime.exceptionFreeToString ( p ) + '"'
			);
		}
	}

	public static validateCalleeMethod ( o : any, p : string, funcInstance : Function ) {
		if ( typeof funcInstance !== 'function' ) {
			throw new Runtime.builtin.TypeError (
				'Property "' + Runtime.exceptionFreeToString ( p ) +
				'" of object ' + Runtime.exceptionFreeToString ( o ) + ' is not a function'
			);
		}
	}

	public toCode () {
		var code : string;

		if ( this.callee.type === MemberExpression.type ) {
			var memberExpr = <MemberExpression> this.callee;
			code = '( ' + memberExpr.toCodeEvalOP () + ',' +
				'rt.validateCalleeObject ( ' +
					'rt.regs [' + memberExpr.object.rResult + '], ' +
					'rt.regs [' + memberExpr.property.rResult + ']' +
				' ), ' +
				'rt.callMethod ( ' +
					'rt.regs [' + memberExpr.object.rResult + '], ' +
					'rt.regs [' + memberExpr.property.rResult + '], ' +
					'[' + this.generateArgumentListCode () + ']' +
				' )' +
			' )';
		} else {
			if ( this.isDirectEval ) {
				code = 'rt.directEval';
				code += ' (' + this.generateArgumentListCode () + ')';
			} else {
				if ( this.callee.type === Identifier.type ) {
					var idNode = <Identifier> this.callee;
					code = 'rt.callFunction ( ' +
						idNode.toQuotedString () + ', ' +
						idNode.rScope + ', ' +
						'[' + this.generateArgumentListCode () + ']' +
					' )';
				} else {
					code = this.embrace ( this.callee );
					code += ' (' + this.generateArgumentListCode () + ')';
				}
			}
		}

		return	code;
	}
}