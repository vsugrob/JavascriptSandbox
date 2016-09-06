interface LCLocation {
	line : number;
	column : number;
}

interface LCRange {
	start : LCLocation;
	end : LCLocation;
}

interface EsAstNode {
	type : string;
	loc? : LCRange;
	range? : number [];
}

enum AstScopeIdentifierKind {
	Variable, Function, Argument, Exception, EnclosingFunction
}

// TODO: hold path : any [] information?
class AstScopeIdentifier {
	constructor ( public name : string, public node : EsAstNode,
		public kind : AstScopeIdentifierKind )
	{}

	public toString () {
		return	AstScopeIdentifierKind ['_map'][this.kind] + ' ' + this.name;
	}
}

class AstScope {
	public ids : AstScopeIdentifier [] = [];
	public children : AstScope [] = [];
	public name : string;
	private static anonFuncCount = 0;

	constructor ( public path : any [], public node : EsAstNode,
		public parent : AstScope = null )
	{
		if ( node ['id'] != null ) {
			/* TODO: function f () {} and var v = function f () {}
			 * can have same name of the scope. Is it ok? */
			this.name = node ['id'].name;
		} else if ( parent === null )
			this.name = 'Global';
		else
			this.name = 'anon' + ( AstScope.anonFuncCount++ );
	}

	public toString () {
		return	this.name;
	}
}

class AstContext {
	public scope : AstScope = null;
	
	constructor ( public analyzeScope : bool ) {}

	public enterScope ( path : any [], node : EsAstNode ) {
		if ( this.scope === null )
			this.scope = new AstScope ( path, node, null );
		else {
			var newScope = new AstScope ( path, node, this.scope );
			this.scope.children.push ( newScope );
			this.scope = newScope;
		}
	}

	public exitScope () {
		if ( this.scope.parent === null )
			throw new Error ( 'Can\'t exit global scope.' );

		this.scope = this.scope.parent;
	}
}

class Ast {
	public static S = {
        AssignmentExpression : 'AssignmentExpression',
        ArrayExpression : 'ArrayExpression',
        BlockStatement : 'BlockStatement',
        BinaryExpression : 'BinaryExpression',
        BreakStatement : 'BreakStatement',
        CallExpression : 'CallExpression',
        CatchClause : 'CatchClause',
        ConditionalExpression : 'ConditionalExpression',
        ContinueStatement : 'ContinueStatement',
        DoWhileStatement : 'DoWhileStatement',
        DebuggerStatement : 'DebuggerStatement',
        EmptyStatement : 'EmptyStatement',
        ExpressionStatement : 'ExpressionStatement',
        ForStatement : 'ForStatement',
        ForInStatement : 'ForInStatement',
        FunctionDeclaration : 'FunctionDeclaration',
        FunctionExpression : 'FunctionExpression',
        Identifier : 'Identifier',
        IfStatement : 'IfStatement',
        Literal : 'Literal',
        LabeledStatement : 'LabeledStatement',
        LogicalExpression : 'LogicalExpression',
        MemberExpression : 'MemberExpression',
        NewExpression : 'NewExpression',
        ObjectExpression : 'ObjectExpression',
        Program : 'Program',
        Property : 'Property',
        ReturnStatement : 'ReturnStatement',
        SequenceExpression : 'SequenceExpression',
        SwitchStatement : 'SwitchStatement',
        SwitchCase : 'SwitchCase',
        ThisExpression : 'ThisExpression',
        ThrowStatement : 'ThrowStatement',
        TryStatement : 'TryStatement',
        UnaryExpression : 'UnaryExpression',
        UpdateExpression : 'UpdateExpression',
        VariableDeclaration : 'VariableDeclaration',
        VariableDeclarator : 'VariableDeclarator',
        WhileStatement : 'WhileStatement',
        WithStatement : 'WithStatement'
    };

	public static walk ( node : any,
		inspectNodeCallback : ( node : EsAstNode, path : any [] ) => bool,
		path? : any [] )
	{
		if ( !Array.isArray ( path ) )
			path = [];

		var nodePath = path.concat ( [node] );

		if ( Array.isArray ( node ) ) {
			var nodes = <EsAstNode []> node;

			for ( var i = 0 ; i < nodes.length ; i++ ) {
				Ast.walk ( nodes [i], inspectNodeCallback, nodePath.concat ( [i + ''] ) );
			}
		} else if ( node != null && typeof node === 'object' ) {
			if ( inspectNodeCallback ( node, nodePath ) )
				return;

			if ( node.type === Ast.S.AssignmentExpression ) {
				Ast.walk ( node.left, inspectNodeCallback, nodePath.concat ( ['left'] ) );
				Ast.walk ( node.right, inspectNodeCallback, nodePath.concat ( ['right'] ) );
			} else if ( node.type === Ast.S.ArrayExpression ) {
				Ast.walk ( node.elements, inspectNodeCallback, nodePath.concat ( ['elements'] ) );
			} else if ( node.type === Ast.S.BlockStatement ) {
				Ast.walk ( node.body, inspectNodeCallback, nodePath.concat ( ['body'] ) );
			} else if ( node.type === Ast.S.BinaryExpression || node.type === Ast.S.LogicalExpression ) {
				Ast.walk ( node.left, inspectNodeCallback, nodePath.concat ( ['left'] ) );
				Ast.walk ( node.right, inspectNodeCallback, nodePath.concat ( ['right'] ) );
			} else if ( node.type === Ast.S.BreakStatement ) {
			} else if ( node.type === Ast.S.CallExpression ) {
				Ast.walk ( node.callee, inspectNodeCallback, nodePath.concat ( ['callee'] ) );
				Ast.walk ( node.arguments, inspectNodeCallback, nodePath.concat ( ['arguments'] ) );
			} else if ( node.type === Ast.S.CatchClause ) {
				Ast.walk ( node.param, inspectNodeCallback, nodePath.concat ( ['param'] ) );
				Ast.walk ( node.body, inspectNodeCallback, nodePath.concat ( ['body'] ) );
			} else if ( node.type === Ast.S.ConditionalExpression ) {
				Ast.walk ( node.test, inspectNodeCallback, nodePath.concat ( ['test'] ) );
				Ast.walk ( node.consequent, inspectNodeCallback, nodePath.concat ( ['consequent'] ) );
				Ast.walk ( node.alternate, inspectNodeCallback, nodePath.concat ( ['alternate'] ) );
			} else if ( node.type === Ast.S.ContinueStatement ) {
			} else if ( node.type === Ast.S.DoWhileStatement ) {
				Ast.walk ( node.body, inspectNodeCallback, nodePath.concat ( ['body'] ) );
				Ast.walk ( node.test, inspectNodeCallback, nodePath.concat ( ['test'] ) );
			} else if ( node.type === Ast.S.DebuggerStatement ) {
			} else if ( node.type === Ast.S.EmptyStatement ) {
			} else if ( node.type === Ast.S.ExpressionStatement ) {
				Ast.walk ( node.expression, inspectNodeCallback, nodePath.concat ( ['expression'] ) );
			} else if ( node.type === Ast.S.ForStatement ) {
				Ast.walk ( node.init, inspectNodeCallback, nodePath.concat ( ['init'] ) );
				Ast.walk ( node.test, inspectNodeCallback, nodePath.concat ( ['test'] ) );
				Ast.walk ( node.update, inspectNodeCallback, nodePath.concat ( ['update'] ) );
				Ast.walk ( node.body, inspectNodeCallback, nodePath.concat ( ['body'] ) );
			} else if ( node.type === Ast.S.ForInStatement ) {
				Ast.walk ( node.left, inspectNodeCallback, nodePath.concat ( ['left'] ) );
				Ast.walk ( node.right, inspectNodeCallback, nodePath.concat ( ['right'] ) );
				Ast.walk ( node.body, inspectNodeCallback, nodePath.concat ( ['body'] ) );
			} else if ( node.type === Ast.S.FunctionDeclaration || node.type === Ast.S.FunctionExpression ) {
				Ast.walk ( node.id, inspectNodeCallback, nodePath.concat ( ['id'] ) );
				Ast.walk ( node.params, inspectNodeCallback, nodePath.concat ( ['params'] ) );
				Ast.walk ( node.defaults, inspectNodeCallback, nodePath.concat ( ['defaults'] ) );
				Ast.walk ( node.body, inspectNodeCallback, nodePath.concat ( ['body'] ) );
			} else if ( node.type === Ast.S.Identifier ) {
			} else if ( node.type === Ast.S.IfStatement ) {
				Ast.walk ( node.test, inspectNodeCallback, nodePath.concat ( ['test'] ) );
                Ast.walk ( node.consequent, inspectNodeCallback, nodePath.concat ( ['consequent'] ) );
                Ast.walk ( node.alternate, inspectNodeCallback, nodePath.concat ( ['alternate'] ) );
			} else if ( node.type === Ast.S.Literal ) {
			} else if ( node.type === Ast.S.LabeledStatement ) {
				Ast.walk ( node.body, inspectNodeCallback, nodePath.concat ( ['body'] ) );
			} else if ( node.type === Ast.S.MemberExpression ) {
				Ast.walk ( node.object, inspectNodeCallback, nodePath.concat ( ['object'] ) );
				Ast.walk ( node.property, inspectNodeCallback, nodePath.concat ( ['property'] ) );
			} else if ( node.type === Ast.S.NewExpression ) {
				Ast.walk ( node.callee, inspectNodeCallback, nodePath.concat ( ['callee'] ) );
				Ast.walk ( node.arguments, inspectNodeCallback, nodePath.concat ( ['arguments'] ) );
			} else if ( node.type === Ast.S.ObjectExpression ) {
				Ast.walk ( node.properties, inspectNodeCallback, nodePath.concat ( ['properties'] ) );
			} else if ( node.type === Ast.S.Program ) {
				Ast.walk ( node.body, inspectNodeCallback, nodePath.concat ( ['body'] ) );
			} else if ( node.type === Ast.S.Property ) {
				Ast.walk ( node.key, inspectNodeCallback, nodePath.concat ( ['key'] ) );
				Ast.walk ( node.value, inspectNodeCallback, nodePath.concat ( ['value'] ) );
			} else if ( node.type === Ast.S.ReturnStatement ) {
				Ast.walk ( node.argument, inspectNodeCallback, nodePath.concat ( ['argument'] ) );
			} else if ( node.type === Ast.S.SequenceExpression ) {
				Ast.walk ( node.expressions, inspectNodeCallback, nodePath.concat ( ['expressions'] ) );
			} else if ( node.type === Ast.S.SwitchStatement ) {
				Ast.walk ( node.discriminant, inspectNodeCallback, nodePath.concat ( ['discriminant'] ) );
				Ast.walk ( node.cases, inspectNodeCallback, nodePath.concat ( ['cases'] ) );
			} else if ( node.type === Ast.S.SwitchCase ) {
				Ast.walk ( node.test, inspectNodeCallback, nodePath.concat ( ['test'] ) );
				Ast.walk ( node.consequent, inspectNodeCallback, nodePath.concat ( ['consequent'] ) );
			} else if ( node.type === Ast.S.ThisExpression ) {
			} else if ( node.type === Ast.S.ThrowStatement ) {
				Ast.walk ( node.argument, inspectNodeCallback, nodePath.concat ( ['argument'] ) );
			} else if ( node.type === Ast.S.TryStatement ) {
				Ast.walk ( node.block, inspectNodeCallback, nodePath.concat ( ['block'] ) );
				Ast.walk ( node.handlers, inspectNodeCallback, nodePath.concat ( ['handlers'] ) );
				Ast.walk ( node.finalizer, inspectNodeCallback, nodePath.concat ( ['finalizer'] ) );
			} else if ( node.type === Ast.S.UnaryExpression || node.type === Ast.S.UpdateExpression ) {
				Ast.walk ( node.argument, inspectNodeCallback, nodePath.concat ( ['argument'] ) );
			} else if ( node.type === Ast.S.VariableDeclaration ) {
				Ast.walk ( node.declarations, inspectNodeCallback, nodePath.concat ( ['declarations'] ) );
			} else if ( node.type === Ast.S.VariableDeclarator ) {
				Ast.walk ( node.id, inspectNodeCallback, nodePath.concat ( ['id'] ) );
				Ast.walk ( node.init, inspectNodeCallback, nodePath.concat ( ['init'] ) );
			} else if ( node.type === Ast.S.WhileStatement ) {
				Ast.walk ( node.test, inspectNodeCallback, nodePath.concat ( ['test'] ) );
				Ast.walk ( node.body, inspectNodeCallback, nodePath.concat ( ['body'] ) );
			} else if ( node.type === Ast.S.WithStatement ) {
				Ast.walk ( node.object, inspectNodeCallback, nodePath.concat ( ['object'] ) );
				Ast.walk ( node.body, inspectNodeCallback, nodePath.concat ( ['body'] ) );
			}
		}
	}

	public static replaceLeafFirst ( node : any,
		replaceCallback : ( node : EsAstNode, path : any [], ctx : AstContext ) => any,
		ctx : AstContext,
		path? : any [] )
	{
		var exitScopeBeforeReturn = false;

		if ( !Array.isArray ( path ) )
			path = [];

		var nodePath = path.concat ( [node] );

		if ( Array.isArray ( node ) ) {
			var nodes = <EsAstNode []> node;

			for ( var i = 0 ; i < nodes.length ; i++ ) {
				var rNode = Ast.replaceLeafFirst ( nodes [i], replaceCallback, ctx, nodePath.concat ( [i + ''] ) );

				if ( rNode == null )	// Node was deleted.
					nodes.splice ( i--, 1 );
				else
					nodes [i] = rNode;
			}
		} else if ( node != null && typeof node === 'object' ) {
			if ( node.type === Ast.S.AssignmentExpression ) {
				node.left = Ast.replaceLeafFirst ( node.left, replaceCallback, ctx, nodePath.concat ( ['left'] ) );
				node.right = Ast.replaceLeafFirst ( node.right, replaceCallback, ctx, nodePath.concat ( ['right'] ) );
			} else if ( node.type === Ast.S.ArrayExpression ) {
				node.elements = Ast.replaceLeafFirst ( node.elements, replaceCallback, ctx, nodePath.concat ( ['elements'] ) );
			} else if ( node.type === Ast.S.BlockStatement ) {
				node.body = Ast.replaceLeafFirst ( node.body, replaceCallback, ctx, nodePath.concat ( ['body'] ) );
			} else if ( node.type === Ast.S.BinaryExpression || node.type === Ast.S.LogicalExpression ) {
				node.left = Ast.replaceLeafFirst ( node.left, replaceCallback, ctx, nodePath.concat ( ['left'] ) );
				node.right = Ast.replaceLeafFirst ( node.right, replaceCallback, ctx, nodePath.concat ( ['right'] ) );
			} else if ( node.type === Ast.S.BreakStatement ) {
			} else if ( node.type === Ast.S.CallExpression ) {
				node.callee = Ast.replaceLeafFirst ( node.callee, replaceCallback, ctx, nodePath.concat ( ['callee'] ) );
				node.arguments = Ast.replaceLeafFirst ( node.arguments, replaceCallback, ctx, nodePath.concat ( ['arguments'] ) );
			} else if ( node.type === Ast.S.CatchClause ) {
				if ( ctx.analyzeScope )
					ctx.scope.ids.push ( new AstScopeIdentifier ( node.param.name, node, AstScopeIdentifierKind.Exception ) );

				node.param = Ast.replaceLeafFirst ( node.param, replaceCallback, ctx, nodePath.concat ( ['param'] ) );
				node.body = Ast.replaceLeafFirst ( node.body, replaceCallback, ctx, nodePath.concat ( ['body'] ) );
			} else if ( node.type === Ast.S.ConditionalExpression ) {
				node.test = Ast.replaceLeafFirst ( node.test, replaceCallback, ctx, nodePath.concat ( ['test'] ) );
				node.consequent = Ast.replaceLeafFirst ( node.consequent, replaceCallback, ctx, nodePath.concat ( ['consequent'] ) );
				node.alternate = Ast.replaceLeafFirst ( node.alternate, replaceCallback, ctx, nodePath.concat ( ['alternate'] ) );
			} else if ( node.type === Ast.S.ContinueStatement ) {
			} else if ( node.type === Ast.S.DoWhileStatement ) {
				node.body = Ast.replaceLeafFirst ( node.body, replaceCallback, ctx, nodePath.concat ( ['body'] ) );
				node.test = Ast.replaceLeafFirst ( node.test, replaceCallback, ctx, nodePath.concat ( ['test'] ) );
			} else if ( node.type === Ast.S.DebuggerStatement ) {
			} else if ( node.type === Ast.S.EmptyStatement ) {
			} else if ( node.type === Ast.S.ExpressionStatement ) {
				node.expression = Ast.replaceLeafFirst ( node.expression, replaceCallback, ctx, nodePath.concat ( ['expression'] ) );
			} else if ( node.type === Ast.S.ForStatement ) {
				node.init = Ast.replaceLeafFirst ( node.init, replaceCallback, ctx, nodePath.concat ( ['init'] ) );
				node.test = Ast.replaceLeafFirst ( node.test, replaceCallback, ctx, nodePath.concat ( ['test'] ) );
				node.update = Ast.replaceLeafFirst ( node.update, replaceCallback, ctx, nodePath.concat ( ['update'] ) );
				node.body = Ast.replaceLeafFirst ( node.body, replaceCallback, ctx, nodePath.concat ( ['body'] ) );
			} else if ( node.type === Ast.S.ForInStatement ) {
				node.left = Ast.replaceLeafFirst ( node.left, replaceCallback, ctx, nodePath.concat ( ['left'] ) );
				node.right = Ast.replaceLeafFirst ( node.right, replaceCallback, ctx, nodePath.concat ( ['right'] ) );
				node.body = Ast.replaceLeafFirst ( node.body, replaceCallback, ctx, nodePath.concat ( ['body'] ) );
			} else if ( node.type === Ast.S.FunctionDeclaration || node.type === Ast.S.FunctionExpression ) {
				if ( ctx.analyzeScope ) {
					if ( node.type === Ast.S.FunctionDeclaration )
						ctx.scope.ids.push ( new AstScopeIdentifier ( node.id.name, node, AstScopeIdentifierKind.Function ) );

					ctx.enterScope ( path, node );
					exitScopeBeforeReturn = true;

					/* FunctionDeclaration generates id within outer scope whereas
					 * FunctionExpression in function-local scope. */
					if ( node.type === Ast.S.FunctionExpression && node.id != null )
						ctx.scope.ids.push ( new AstScopeIdentifier ( node.id.name, node, AstScopeIdentifierKind.EnclosingFunction ) );

					for ( var i = 0 ; i < node.params.length ; i++ ) {
						var paramNode = node.params [i];
						ctx.scope.ids.push ( new AstScopeIdentifier ( paramNode.name, paramNode, AstScopeIdentifierKind.Argument ) );
					}

					node.scope = ctx.scope;
				}

				node.id = Ast.replaceLeafFirst ( node.id, replaceCallback, ctx, nodePath.concat ( ['id'] ) );
				node.params = Ast.replaceLeafFirst ( node.params, replaceCallback, ctx, nodePath.concat ( ['params'] ) );
				node.defaults = Ast.replaceLeafFirst ( node.defaults, replaceCallback, ctx, nodePath.concat ( ['defaults'] ) );
				node.body = Ast.replaceLeafFirst ( node.body, replaceCallback, ctx, nodePath.concat ( ['body'] ) );
			} else if ( node.type === Ast.S.Identifier ) {
			} else if ( node.type === Ast.S.IfStatement ) {
				node.test = Ast.replaceLeafFirst ( node.test, replaceCallback, ctx, nodePath.concat ( ['test'] ) );
                node.consequent = Ast.replaceLeafFirst ( node.consequent, replaceCallback, ctx, nodePath.concat ( ['consequent'] ) );
                node.alternate = Ast.replaceLeafFirst ( node.alternate, replaceCallback, ctx, nodePath.concat ( ['alternate'] ) );
			} else if ( node.type === Ast.S.Literal ) {
			} else if ( node.type === Ast.S.LabeledStatement ) {
				node.body = Ast.replaceLeafFirst ( node.body, replaceCallback, ctx, nodePath.concat ( ['body'] ) );
			} else if ( node.type === Ast.S.MemberExpression ) {
				node.object = Ast.replaceLeafFirst ( node.object, replaceCallback, ctx, nodePath.concat ( ['object'] ) );
				node.property = Ast.replaceLeafFirst ( node.property, replaceCallback, ctx, nodePath.concat ( ['property'] ) );
			} else if ( node.type === Ast.S.NewExpression ) {
				node.callee = Ast.replaceLeafFirst ( node.callee, replaceCallback, ctx, nodePath.concat ( ['callee'] ) );
				node.arguments = Ast.replaceLeafFirst ( node.arguments, replaceCallback, ctx, nodePath.concat ( ['arguments'] ) );
			} else if ( node.type === Ast.S.ObjectExpression ) {
				node.properties = Ast.replaceLeafFirst ( node.properties, replaceCallback, ctx, nodePath.concat ( ['properties'] ) );
			} else if ( node.type === Ast.S.Program ) {
				if ( ctx.analyzeScope )
					ctx.enterScope ( path, node );

				node.body = Ast.replaceLeafFirst ( node.body, replaceCallback, ctx, nodePath.concat ( ['body'] ) );
			} else if ( node.type === Ast.S.Property ) {
				node.key = Ast.replaceLeafFirst ( node.key, replaceCallback, ctx, nodePath.concat ( ['key'] ) );
				node.value = Ast.replaceLeafFirst ( node.value, replaceCallback, ctx, nodePath.concat ( ['value'] ) );
			} else if ( node.type === Ast.S.ReturnStatement ) {
				node.argument = Ast.replaceLeafFirst ( node.argument, replaceCallback, ctx, nodePath.concat ( ['argument'] ) );
			} else if ( node.type === Ast.S.SequenceExpression ) {
				node.expressions = Ast.replaceLeafFirst ( node.expressions, replaceCallback, ctx, nodePath.concat ( ['expressions'] ) );
			} else if ( node.type === Ast.S.SwitchStatement ) {
				node.discriminant = Ast.replaceLeafFirst ( node.discriminant, replaceCallback, ctx, nodePath.concat ( ['discriminant'] ) );
				node.cases = Ast.replaceLeafFirst ( node.cases, replaceCallback, ctx, nodePath.concat ( ['cases'] ) );
			} else if ( node.type === Ast.S.SwitchCase ) {
				node.test = Ast.replaceLeafFirst ( node.test, replaceCallback, ctx, nodePath.concat ( ['test'] ) );
				node.consequent = Ast.replaceLeafFirst ( node.consequent, replaceCallback, ctx, nodePath.concat ( ['consequent'] ) );
			} else if ( node.type === Ast.S.ThisExpression ) {
			} else if ( node.type === Ast.S.ThrowStatement ) {
				node.argument = Ast.replaceLeafFirst ( node.argument, replaceCallback, ctx, nodePath.concat ( ['argument'] ) );
			} else if ( node.type === Ast.S.TryStatement ) {
				node.block = Ast.replaceLeafFirst ( node.block, replaceCallback, ctx, nodePath.concat ( ['block'] ) );
				node.handlers = Ast.replaceLeafFirst ( node.handlers, replaceCallback, ctx, nodePath.concat ( ['handlers'] ) );
				node.finalizer = Ast.replaceLeafFirst ( node.finalizer, replaceCallback, ctx, nodePath.concat ( ['finalizer'] ) );
			} else if ( node.type === Ast.S.UnaryExpression || node.type === Ast.S.UpdateExpression ) {
				node.argument = Ast.replaceLeafFirst ( node.argument, replaceCallback, ctx, nodePath.concat ( ['argument'] ) );
			} else if ( node.type === Ast.S.VariableDeclaration ) {
				node.declarations = Ast.replaceLeafFirst ( node.declarations, replaceCallback, ctx, nodePath.concat ( ['declarations'] ) );
			} else if ( node.type === Ast.S.VariableDeclarator ) {
				if ( ctx.analyzeScope )
					ctx.scope.ids.push ( new AstScopeIdentifier ( node.id.name, node, AstScopeIdentifierKind.Variable ) );

				node.id = Ast.replaceLeafFirst ( node.id, replaceCallback, ctx, nodePath.concat ( ['id'] ) );
				node.init = Ast.replaceLeafFirst ( node.init, replaceCallback, ctx, nodePath.concat ( ['init'] ) );
			} else if ( node.type === Ast.S.WhileStatement ) {
				node.test = Ast.replaceLeafFirst ( node.test, replaceCallback, ctx, nodePath.concat ( ['test'] ) );
				node.body = Ast.replaceLeafFirst ( node.body, replaceCallback, ctx, nodePath.concat ( ['body'] ) );
			} else if ( node.type === Ast.S.WithStatement ) {
				node.object = Ast.replaceLeafFirst ( node.object, replaceCallback, ctx, nodePath.concat ( ['object'] ) );
				node.body = Ast.replaceLeafFirst ( node.body, replaceCallback, ctx, nodePath.concat ( ['body'] ) );
			}
		}

		try {
			if ( node != null ) {
				var rNode = replaceCallback ( node, path, ctx );

				if ( !Array.isArray ( rNode ) && rNode != null ) {
					if ( 'loc' in node )
						rNode.loc = node.loc;

					if ( 'range' in node )
						rNode.range = node.range;
				}

				return	rNode;
			} else
				return	node;
		} finally {
			if ( ctx.analyzeScope && exitScopeBeforeReturn )
				ctx.exitScope ();
		}
	}
}