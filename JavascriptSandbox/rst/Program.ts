/// <reference path="ScopeNode.ts" />

interface FunctionRegistry {
	[id : number] : FunctionNode;
}

class Program extends ScopeNode {
	private static ProgramNodeCounter = 0;
	public static get type () { return	'Program'; }
	public body : RstNode [];
	public functionRegistry = <FunctionRegistry> Runtime.builtin.create ( null );
	public programId : number;

	private rStatementIdx : number;

	constructor ( body : RstNode [] = [], loc? : SourceLocation, isStrict = false, name? : string ) {
		super ( loc );
		this.rStatementIdx = RstNode.maxRegisterId++;
		this.programId = Program.ProgramNodeCounter++;
		this.linkChildren ( body, 'body' );

		if ( name != null )
			this.name = name + '';
		else
			this.name = 'program';

		this.fullName = this.name;
		this.isStrict = !!isStrict || this.checkScopeIsStrict ( this.body );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		RstNode.visitNodeArrayDepthFirst ( this.body, callback );
	}

	public onEnter ( runtime : Runtime ) {
		this.enterProgramScope ( runtime );
		runtime.regs [this.rStatementIdx] = 0;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rStatementIdx] >= this.body.length ) {
			runtime.exitFrame ();

			var nextNode = runtime.currentFrame.callerNode;

			if ( nextNode !== null ) {
				runtime.nextNode = nextNode;
				// Exit 'eval' stack frame pushed in Runtime.createEvalProgram ().
				runtime.exitFrame ();
				runtime.regs [nextNode.rResult] = runtime.lr;
			}

			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		} else
			runtime.nextNode = this.body [runtime.regs [this.rStatementIdx]++];
	}

	public enterProgramScope ( runtime : Runtime ) {
		runtime.enterFrame ( new StackFrame (
			runtime.currentScope, this.name,
			runtime.currentFrame.funcInstance,	// No extra function instance in stack data for program.
			null,	// callerNode.
			this.isStrict
		) );
		this.enterScope ( runtime );
	}

	public createInstance ( runtime : Runtime, thisObj : any ) {
		var factoryFunc = new Runtime.builtin.Function ( 'rt',
				// TODO: include tough globals undef code.
				this.toCode ()
			),
			funcInstance = <Function> Runtime.builtin.bind.call ( factoryFunc, thisObj, runtime );

		return	funcInstance;
	}

	public toCode () {
		var code = '';

		if ( this.isStrict )
			code += '"use strict";\n';

		code += 'try {\n';
		code += 'rt.initProgramScope (' + this.programId + ');\n';

		for ( var i = 0 ; i < this.body.length ; i++ ) {
			var statement = this.body [i],
				sCode = statement.toCode ();

			if ( sCode )
				code += sCode + '\n';
		}

		code += '} finally { rt.exitFrame (); }\n';
		code += 'return rt.lr;\n';

		return	code;
	}
}