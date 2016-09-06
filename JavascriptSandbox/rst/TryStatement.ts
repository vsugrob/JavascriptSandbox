/// <reference path="RstNode.ts" />

enum TryStatementState {
	EvalBlock = undefined,
	HandleException = 1,
	SetHandled = 2,
	EvalFinalizer = 3,
	OnEvalFinalizerDone = 4
}

class TryStatement extends RstNode {
	public static get type () { return	'TryStatement'; }
	public block : BlockStatement;
	public handlers : CatchClause [] = [];
	public finalizer : BlockStatement;

	public rState : number;
	public rException : number;
	public rExceptionIsUnhandled : number;
	public rLiftTarget : number;
	
	constructor (
		block : BlockStatement,
		handlers : CatchClause [] = [],
		finalizer : BlockStatement = null,
		loc? : SourceLocation
	) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.rException = RstNode.maxRegisterId++;
		this.rExceptionIsUnhandled = RstNode.maxRegisterId++;
		this.rLiftTarget = RstNode.maxRegisterId++;
		this.linkChild ( block, 'block' );
		this.linkChildren ( handlers, 'handlers' );
		this.linkChild ( finalizer, 'finalizer' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.block.visitDepthFirst ( callback );

		for ( var i = 0 ; i < this.handlers.length ; i++ ) {
			var handler = this.handlers [i];
			handler.visitDepthFirst ( callback );
		}

		if ( this.finalizer )
			this.finalizer.visitDepthFirst ( callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rState] = TryStatementState.EvalBlock;
		runtime.regs [this.rException] = undefined;
		runtime.regs [this.rExceptionIsUnhandled] = false;
		runtime.regs [this.rLiftTarget] = null;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === TryStatementState.EvalBlock ) {
			runtime.nextNode = this.block;
			runtime.regs [this.rState] = TryStatementState.EvalFinalizer;
		} else if ( runtime.regs [this.rState] === TryStatementState.HandleException ) {
			if ( this.handlers.length !== 0 ) {
				/* Note: evaluate only first handler since multiple handlers
				 * is not standard feature of ecma script. */
				var handler = this.handlers [0];
				runtime.regs [handler.rException] = runtime.regs [this.rException];
				runtime.nextNode = handler;
				runtime.regs [this.rExceptionIsUnhandled] = true;
			}
			
			runtime.regs [this.rState] = TryStatementState.SetHandled;
		} else if ( runtime.regs [this.rState] === TryStatementState.SetHandled ) {
			runtime.regs [this.rExceptionIsUnhandled] = false;
			runtime.regs [this.rState] = TryStatementState.EvalFinalizer;
		} else if ( runtime.regs [this.rState] === TryStatementState.EvalFinalizer ) {
			if ( this.finalizer !== null )
				runtime.nextNode = this.finalizer;
			
			runtime.regs [this.rState] = TryStatementState.OnEvalFinalizerDone;
		} else if ( runtime.regs [this.rState] === TryStatementState.OnEvalFinalizerDone ) {
			runtime.regs [this.rNodeState] = RstNodeState.Finished;

			if ( runtime.regs [this.rExceptionIsUnhandled] )
				throw	runtime.regs [this.rException];
			else if ( runtime.regs [this.rLiftTarget] !== null ) {
				runtime.regs [this.rNodeState] = RstNodeState.NotInitialized;
				runtime.jump ( this.parent );
				runtime.lift ( runtime.regs [this.rLiftTarget] );
			}
		}
	}

	public toCode () {
		var code = 'try ' + this.block.toCode ();

		if ( this.handlers.length !== 0 )
			code += ' ' + this.handlers [0].toCode ();

		if ( this.finalizer !== null )
			code += ' finally ' + this.finalizer.toCode ();

		return	code;
	}
}