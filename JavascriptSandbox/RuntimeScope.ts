/// <reference path="Runtime.ts" />

enum ScopeKind {
	Normal,
	LetBlock,	// Reserved for future implementation of 'let' variables.
	CatchClause,
	WithStatement,
	Eval
}

/* TODO: slightly reimplement so we can fork scope and set vars property of new
 * scope in one step. */
class RuntimeScope {
	public fullName : string;
	public parent : RuntimeScope = null;
	public kind : ScopeKind = ScopeKind.Normal;

	constructor ( public name : string, public vars : any, public thisObj : any ) {}

	public static fromObject ( name : string, varsObj : any, thisObj : any ) {
		var s = new RuntimeScope ( name, varsObj, thisObj );
		s.fullName = name;

		return	s;
	}

	public static forkCurrent ( name : string, parent : RuntimeScope, thisObj : any ) {
		// TODO: old implementation, remove.
		//var varsObj = Runtime.builtin.create ( parent.vars ),
		var varsObj = Runtime.builtin.create ( null ),
			s = new RuntimeScope ( name, varsObj, thisObj );

		s.parent = parent;
		s.fullName = name;

		var ps = parent;

		while ( ps !== null ) {
			s.fullName = ps.name + '.' + s.fullName;
			ps = ps.parent;
		}

		return	s;
	}
}

System.breakPrototypeChain ( RuntimeScope );