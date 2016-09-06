/// <reference path="RstNode.ts" />

class EmptyStatement extends RstNode {
	public static get type () { return	'EmptyStatement'; }

	constructor ( loc? : SourceLocation ) {
		super ( loc );
	}

	public toCode () {
		return	';';
	}
}