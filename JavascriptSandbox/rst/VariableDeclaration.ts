/// <reference path="RstNode.ts" />
/// <reference path="VariableDeclarator.ts" />

class VariableDeclaration extends RstNode {
	public static get type () { return	'VariableDeclaration'; }
	public declarations : VariableDeclarator [];

	private rDeclIdx : number;

	constructor ( public kind : string, declarations : VariableDeclarator [] = [], loc? : SourceLocation ) {
		super ( loc );
		this.rDeclIdx = RstNode.maxRegisterId++;
		this.linkChildren ( declarations, 'declarations' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		RstNode.visitNodeArrayDepthFirst ( this.declarations, callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rDeclIdx] = 0;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rDeclIdx] >= this.declarations.length )
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		else
			runtime.nextNode = this.declarations [runtime.regs [this.rDeclIdx]++];
	}

	public toCode () : string {
		var dCode = [];

		for ( var i = 0 ; i < this.declarations.length ; i++ ) {
			var varDecl = this.declarations [i],
				vdCode = varDecl.toCode ();

			if ( vdCode )
				Runtime.builtin.push.call ( dCode, vdCode );
		}

		return	Runtime.builtin.join.call ( dCode, '\n' );
	}
}