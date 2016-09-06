/// <reference path="FunctionNode.ts" />

class FunctionDeclaration extends FunctionNode {
	public static get type () { return	'FunctionDeclaration'; }
	
	constructor (
		id : Identifier,
		params : Identifier [] = [],
		body = new BlockStatement ( [] ),
		loc? : SourceLocation
	) {
		super ( id, params, body, loc );
	}

	public onTreeCompleted () {
		super.onTreeCompleted ();
		this.parentScopeNode.addFunction ( this );
	}
}