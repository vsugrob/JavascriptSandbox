/// <reference path="Runtime.ts" />
/// <reference path="RuntimeScope.ts" />

class StackFrame {
	public registers : any = Runtime.builtin.create ( null );
	public currentScope : RuntimeScope;

	constructor (
		public scope : RuntimeScope,
		public name : string,
		public funcInstance : Function = null,
		public callerNode : RstNode = null,
		public isStrict = false )
	{
		this.currentScope = scope;
	}
}

System.breakPrototypeChain ( StackFrame );