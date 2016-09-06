/// <reference path="RstNode.ts" />

enum WithStatementState {
	EvalObject = undefined,
	EvalBody = 1,
	OnEvalBodyDone = 2
}

class WithStatement extends RstNode {
	public static get type () { return	'WithStatement'; }
	public object : RstNode;
	public body : RstNode;

	private rState : number;

	constructor ( object : RstNode, body : RstNode, loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.linkChild ( object, 'object' );
		this.linkChild ( body, 'body' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.object.visitDepthFirst ( callback );
		this.body.visitDepthFirst ( callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rState] = WithStatementState.EvalObject;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === WithStatementState.EvalObject ) {
			runtime.nextNode = this.object;
			runtime.regs [this.rState] = WithStatementState.EvalBody;
		} else if ( runtime.regs [this.rState] === WithStatementState.EvalBody ) {
			var objectValue = runtime.regs [this.object.rResult];
			runtime.enterWithSubScope ( objectValue );
			runtime.nextNode = this.body;
			runtime.regs [this.rState] = WithStatementState.OnEvalBodyDone;
		} else if ( runtime.regs [this.rState] === WithStatementState.OnEvalBodyDone ) {
			runtime.exitSubScope ();
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		}
	}

	public toCode () {
		var code = 'rt.enterWithSubScope ( ' + this.object.toCode () + ' );\n';
		code += 'try {\n';
		code += this.body.toCode () + '\n';
		code += '} finally {\n';
		code += 'rt.exitSubScope ();\n';
		code += '}';

		return	code;
	}
}