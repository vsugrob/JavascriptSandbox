/// <reference path="../../rst/RstNode.ts" />

var globalObject = this,
	runtime = new Runtime ( globalObject );

globalObject.eval = runtime.createEvalFuncInstance ();
globalObject.Function = runtime.createFuncCtorInstance ();
globalObject.Function.prototype.bind = runtime.createBindFuncInstance ();

function RuntimeEntryPoint ( code : string ) {
	var programNode = runtime.compile ( code, 'main' );
	runtime.setProgram ( programNode );
	runtime.run ();
	//runtime.runWithScopeControl ();
}