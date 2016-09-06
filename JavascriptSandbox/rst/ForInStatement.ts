/// <reference path="RstNode.ts" />

enum ForInStatementState {
	EvalRight = undefined,
	PumpKey = 1,
	WriteKeyToLeft = 2,
	OnWriteKeyToLeftDone = 3
}

class ForInStatement extends RstNode {
	public static get type () { return	'ForInStatement'; }
	public left : RstNode;
	public right : RstNode;
	public body : RstNode;
	public isValid : bool;

	private rState : number;
	private rKeys : number;
	private rKeyIdx : number;
	private rKey : number;

	// TODO: implement isForEach.
	constructor ( left : RstNode, right : RstNode, body : RstNode, public isForEach : bool, loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.rKeys = RstNode.maxRegisterId++;
		this.rKeyIdx = RstNode.maxRegisterId++;
		this.rKey = RstNode.maxRegisterId++;
		this.linkChild ( left, 'left' );
		this.linkChild ( right, 'right' );
		this.linkChild ( body, 'body' );
		this.isValid = this.left.type === VariableDeclaration.type || this.left.isLeftHandSideExpression;
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.left.visitDepthFirst ( callback );
		this.right.visitDepthFirst ( callback );
		this.body.visitDepthFirst ( callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rState] = ForInStatementState.EvalRight;
		runtime.regs [this.rKeys] = undefined;
		runtime.regs [this.rKeyIdx] = 0;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === ForInStatementState.EvalRight ) {
			runtime.nextNode = this.right;
			runtime.regs [this.rState] = ForInStatementState.PumpKey;
		} else if ( runtime.regs [this.rState] === ForInStatementState.PumpKey ) {
			if ( !this.isValid )
				runtime.throwInvalidLHS ( 'for-in' );

			var keys : string [] = runtime.regs [this.rKeys],
				rightValue = runtime.regs [this.right.rResult],
				typeofRightValue = typeof rightValue,
				valIsNormalEnumerable = typeofRightValue === 'function' ||
					( typeofRightValue === 'object' && rightValue !== null );

			if ( keys === undefined ) {
				keys = [];

				if ( typeofRightValue === 'string' ) {
					for ( var i = 0 ; i < rightValue.length ; i++ ) {
						Runtime.builtin.push.call ( keys, i + '' );
					}
				} else if ( valIsNormalEnumerable ) {
					var o = rightValue,
						protoChain = [],
						// Note: this hash set have no collisions with '__proto__' key.
						keysHashSet = Runtime.builtin.create ( null );

					do {
						Runtime.builtin.push.call ( protoChain, o );
					} while ( null !== ( o = Runtime.builtin.getPrototypeOf ( o ) ) );

					for ( var i = 0 ; i < protoChain.length ; i++ ) {
						o = protoChain [i];
						var oKeys = Runtime.builtin.keys ( o );

						for ( var j = 0 ; j < oKeys.length ; j++ ) {
							var key = oKeys [j];

							// Note: there is no collision with '__proto__'.
							if ( !( key in keysHashSet ) )
								keysHashSet [key] = true;
						}
					}

					keys = Runtime.builtin.keys ( keysHashSet );
				}

				runtime.regs [this.rKeys] = keys;
			}

			if ( runtime.regs [this.rKeyIdx] >= keys.length ) {
				this.finish ( runtime );

				return;
			}

			var key : string = undefined,
				keyIdx : number;

			do {
				keyIdx = runtime.regs [this.rKeyIdx]++;
				key = keys [keyIdx];

				if ( keyIdx === 0 ) {
					// We've just retrieved the keys. The key at index 0 is definitely there.
					break;
				} else if ( valIsNormalEnumerable ) {
					/* Keys of string rightValue immutable whereas keys of object/function
					 * could be altered: some of them could be deleted while executing loop body.
					 * Note: there is no collision with '__proto__'. */
					if ( !( key in rightValue ) )
						key = undefined;
				}
			} while ( key === undefined && runtime.regs [this.rKeyIdx] < keys.length );

			if ( key === undefined )
				this.finish ( runtime );
			else {
				runtime.regs [this.rKey] = key;
				/* When left side is:
				 * VariableDeclaration - evaluate once, identifier used as assignment destination.
				 * Identifier - do not evaluate.
				 * MemberExpression - object and property evaluated each iteration
					before assigning the member using o [p] = key.
				 */
				if ( this.left.type === VariableDeclaration.type ) {
					if ( keyIdx === 0 ) {
						runtime.nextNode = this.left;
						runtime.regs [this.rState] = ForInStatementState.WriteKeyToLeft;
					} else {
						this.assignKeyToVarDecl ( runtime, key );
						runtime.nextNode = this.body;
						runtime.regs [this.rState] = ForInStatementState.PumpKey;
					}
				} else if ( this.left.type === Identifier.type ) {
					var id = <Identifier> this.left;
					runtime.setVar ( id.name, key );
					runtime.nextNode = this.body;
					runtime.regs [this.rState] = ForInStatementState.PumpKey;
				} else /*if ( this.left.type === MemberExpression.type )*/ {
					RstNode.setMemberExpressionPurpose ( runtime, this.left, MemberExpressionPurpose.EvalOP );
					runtime.nextNode = this.left;
					runtime.regs [this.rState] = ForInStatementState.WriteKeyToLeft;
				}
			}
		} else if ( runtime.regs [this.rState] === ForInStatementState.WriteKeyToLeft ) {
			var key : string = runtime.regs [this.rKey];

			if ( this.left.type === VariableDeclaration.type ) {
				this.assignKeyToVarDecl ( runtime, key );
				runtime.nextNode = this.body;
				runtime.regs [this.rState] = ForInStatementState.PumpKey;
			} else /*if ( this.left.type === MemberExpression.type )*/ {
				RstNode.setMemberExpressionPurpose ( runtime, this.left, MemberExpressionPurpose.WriteValue );
				runtime.regs [this.left.rResult] = key;
				runtime.nextNode = this.left;
				runtime.regs [this.rState] = ForInStatementState.OnWriteKeyToLeftDone;
			}
		} else if ( runtime.regs [this.rState] === ForInStatementState.OnWriteKeyToLeftDone ) {
			runtime.nextNode = this.body;
			runtime.regs [this.rState] = ForInStatementState.PumpKey;
		}
	}

	private assignKeyToVarDecl ( runtime : Runtime, key : string ) {
		var varDecl = <VariableDeclarator> ( <VariableDeclaration> this.left ).declarations [0];
		runtime.setVar ( varDecl.id.name, key );
	}

	private finish ( runtime : Runtime ) {
		var bodyValue = runtime.regs [this.body.rResult];
		runtime.regs [this.rResult] = bodyValue;
		runtime.regs [this.rNodeState] = RstNodeState.Finished;
	}

	public toCode () {
		var code = 'for ( var forInKey in ' + this.right.toCode () + ' ) {\n';

		if ( this.left.type === VariableDeclaration.type ) {
			// for..in loop accepts exactly one variable declarator.
			var varDecl = ( <VariableDeclaration> this.left ).declarations [0];

			if ( varDecl.init !== null )
				code += this.left.toCode () + '\n';	// Evaluate variable declaration once.

			code += 'rt.setVar ( "' + varDecl.id.name + '", forInKey );\n';
		} else if ( this.left.type === Identifier.type ) {
			var id = <Identifier> this.left;
			code += 'rt.setVar ( "' + id.name + '", forInKey );\n';
		} else if ( this.left.type === MemberExpression.type ) {
			// Preserve natural execution order using registers.
			var memberExpr = <MemberExpression> this.left;
			code += memberExpr.toCodeEvalOPAndWriteMember ( 'forInKey' ) + ';\n';
		} else /*if ( !this.isValid )*/
			code += 'rt.throwInvalidLHS ( "for-in" );\n';

		code += this.body.toCode ();
		code += '\n}';

		return	code;
	}
}