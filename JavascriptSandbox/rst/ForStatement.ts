/// <reference path="RstNode.ts" />

enum ForStatementState {
	EvalInit = undefined,
	EvalTest = 1,
	EvalBody = 2,
	EvalUpdate = 3
}

class ForStatement extends RstNode {
	public static get type () { return	'ForStatement'; }
	public init : RstNode;
	public test : RstNode;
	public update : RstNode;
	public body : RstNode;

	private rState : number;

	constructor ( init : RstNode, test : RstNode, update : RstNode, body : RstNode, loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.linkChild ( init, 'init' );
		this.linkChild ( test, 'test' );
		this.linkChild ( update, 'update' );
		this.linkChild ( body, 'body' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );

		if ( this.init )
			this.init.visitDepthFirst ( callback );

		if ( this.test )
			this.test.visitDepthFirst ( callback );

		if ( this.update )
			this.update.visitDepthFirst ( callback );

		this.body.visitDepthFirst ( callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rState] = ForStatementState.EvalInit;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === ForStatementState.EvalInit ) {
			runtime.nextNode = this.init;
			runtime.regs [this.rState] = ForStatementState.EvalTest;
		} else if ( runtime.regs [this.rState] === ForStatementState.EvalTest ) {
			runtime.nextNode = this.test;
			runtime.regs [this.rState] = ForStatementState.EvalBody;
		} else if ( runtime.regs [this.rState] === ForStatementState.EvalBody ) {
			var testValue = true;

			if ( this.test !== null )
				testValue = runtime.regs [this.test.rResult];

			if ( !testValue ) {
				var bodyValue = runtime.regs [this.body.rResult];
				runtime.regs [this.rResult] = bodyValue;
				runtime.regs [this.rNodeState] = RstNodeState.Finished;
			} else {
				runtime.nextNode = this.body;
				runtime.regs [this.rState] = ForStatementState.EvalUpdate;
			}
		} else if ( runtime.regs [this.rState] === ForStatementState.EvalUpdate ) {
			runtime.nextNode = this.update;
			runtime.regs [this.rState] = ForStatementState.EvalTest;
		}
	}

	public toCode () {
		var code = 'for ( ',
			skipInitSemicolon = false;

		if ( this.init !== null ) {
			code += this.init.toCode ();

			if ( this.init.type === VariableDeclaration.type )
				skipInitSemicolon = true;
		}

		if ( !skipInitSemicolon )
			code += '; ';

		if ( this.test !== null )
			code += this.test.toCode ();

		code += '; ';

		if ( this.update !== null )
			code += this.update.toCode ();

		code += ' ) ';
		code += RstNode.encurly ( this.body );

		return	code;
	}
}