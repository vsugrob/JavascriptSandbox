/// <reference path="RstNode.ts" />
/// <reference path="Identifier.ts" />

enum VariableDeclaratorState {
	Init = undefined,
	Assign = 1
}

class VariableDeclarator extends RstNode {
	public static get type () { return	'VariableDeclarator'; }
	public id : Identifier;
	public init : RstNode;

	private rState : number;

	constructor ( id : Identifier, init : RstNode, loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.linkChild ( id, 'id' );
		this.linkChild ( init, 'init' );
	}

	public onTreeCompleted () {
		this.parentScopeNode.addVarName ( this.id.name );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.id.visitDepthFirst ( callback );

		if ( this.init )
			this.init.visitDepthFirst ( callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rState] = VariableDeclaratorState.Init;
	}

	public onStep ( runtime : Runtime ) {
		if ( this.init === null )
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		else {
			if ( runtime.regs [this.rState] === VariableDeclaratorState.Init ) {
				runtime.nextNode = this.init;
				runtime.regs [this.rState] = VariableDeclaratorState.Assign;
			} else /*if ( runtime.registers [this.rState] === VariableDeclaratorState.Assign )*/ {
				var initValue = runtime.regs [this.init.rResult];
				runtime.setVar ( this.id.name, initValue );
				runtime.regs [this.rNodeState] = RstNodeState.Finished;
			}
		}
	}

	public toCode () {
		if ( this.init === null )
			return	'';
		else
			return	'rt.setVar ( "' + this.id.name + '", ' + this.init.toCode () + ' );';
	}
}