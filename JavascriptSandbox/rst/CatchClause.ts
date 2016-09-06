/// <reference path="RstNode.ts" />

class CatchClause extends RstNode {
	public static get type () { return	'CatchClause'; }
	public param : Identifier;
	public body : BlockStatement;
	private catchScopeName : string;

	public rException : number;

	constructor ( param : Identifier, body : BlockStatement, loc? : SourceLocation ) {
		super ( loc );
		this.rException = RstNode.maxRegisterId++;
		this.linkChild ( param, 'param' );
		this.linkChild ( body, 'body' );
	}

	public onTreeCompleted () {
		var nestingLevel = 0,
			node = <RstNode> this;

		while ( null !== ( node = node.parent ) ) {
			nestingLevel++;
		}

		this.catchScopeName = 'catch' + nestingLevel;
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.param.visitDepthFirst ( callback );
		this.body.visitDepthFirst ( callback );
	}

	public onEnter ( runtime : Runtime ) {
		/* Note: rException is intentionally left uninitialized
		 * because its value comes from outside. */
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rNodeState] === RstNodeState.Initialized ) {
			this.enterCatchScope ( runtime );
			runtime.nextNode = this.body;
			runtime.regs [this.rNodeState] = RstNodeState.Working;
		} else if ( runtime.regs [this.rNodeState] === RstNodeState.Working ) {
			this.exitCatchScope ( runtime );
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		}
	}

	public enterCatchScope ( runtime : Runtime ) {
		var name = this.param.name,
			excValue = runtime.regs [this.rException];

		runtime.enterSubScope ( 'catch', ScopeKind.CatchClause );
		runtime.defVar ( name, excValue );
	}

	public exitCatchScope ( runtime : Runtime ) {
		runtime.exitSubScope ();
	}

	public toCode () {
		var code = 'catch ( excVar ) {\n';
		code += 'rt.enterSubScope ( "' + this.catchScopeName + '" );\n';
		code += 'rt.defVar ( "' + this.param.name + '", excVar );\n';
		code += 'try {\n';
		code += this.body.toCode () + '\n';
		code += '} finally {\n';
		code += 'rt.exitSubScope ();\n';
		code += '}\n';
		code += '}';	// End catch.

		return	code;
	}
}