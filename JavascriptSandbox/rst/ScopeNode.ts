/// <reference path="RstNode.ts" />

class ScopeNode extends RstNode {
	public name : string;
	public fullName : string;
	public varNames : string [] = [];
	//public letNames : string [] = [];	// TODO: ScopeNode should inherit BlockNode containing this property.
	public functions : FunctionDeclaration [] = [];
	public isStrict = false;

	constructor ( loc? : SourceLocation ) {
		super ( loc );
	}

	public checkScopeIsStrict ( statements : RstNode [] ) {
		for ( var i = 0 ; i < statements.length ; i++ ) {
			var statement = statements [i];

			if ( statement.type === ExpressionStatement.type &&
				( <ExpressionStatement> statement ).expression.type === Literal.type )
			{
				var literalNode = <Literal> ( <ExpressionStatement> statement ).expression;
				
				if ( typeof literalNode.value !== 'string' )
					return	false;
				else {
					var str = <string> literalNode.value,
						loc = literalNode.loc;

					if ( str === 'use strict' ) {
						if ( loc == null ||
							( loc.start.line === loc.end.line &&
							  loc.end.column - loc.start.column === 10 + 2 )	// 10 is length of 'use strict', 2 for quotes.
						) {
							return	true;
						}
					}
				}
			} else
				return	false;
		}

		return	false;
	}

	// TODO: addVar ( varNode : VariableDeclarator ) ?
	public addVarName ( varName : string ) {
		if ( -1 === Runtime.builtin.indexOf.call ( this.varNames, varName ) )
			Runtime.builtin.push.call ( this.varNames, varName );
	}

	public addFunction ( funcNode : FunctionDeclaration ) {
		for ( var i = 0 ; i < this.functions.length ; i++ ) {
			var existingFuncNode = this.functions [i];

			if ( existingFuncNode.name === funcNode.name ) {
				this.functions [i] = funcNode;

				return;
			}
		}

		Runtime.builtin.push.call ( this.functions, funcNode );
	}

	public initVars ( runtime : Runtime ) {
		for ( var i = 0 ; i < this.varNames.length ; i++ )
			runtime.defVar ( this.varNames [i], undefined, false );
	}

	public initFunctions ( runtime : Runtime ) {
		for ( var i = 0 ; i < this.functions.length ; i++ ) {
			var funcDecl = this.functions [i],
				name = funcDecl.id.name;

			runtime.assertCanDefFunc ( name );
			var funcInstance = funcDecl.createInstance ( runtime );

			runtime.defVar ( name, funcInstance );
		}
	}

	// TODO: rename to initScope?
	public enterScope ( runtime : Runtime ) {
		this.initVars ( runtime );
		this.initFunctions ( runtime );
	}
}