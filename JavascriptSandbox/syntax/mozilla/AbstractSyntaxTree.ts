/// <reference path="../SourceLocation.ts" />
'use strict';

/* Node objects:
 * spec: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API#Node_objects */
interface AstNode {
    type : string;
    loc : SourceLocation;	// Depending on parser options may be null.
}

/* Programs:
 * spec: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API#Programs */
interface ProgramAstNode extends AstNode {
    body : StatementAstNode [];
}

/* Functions:
 * spec: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API#Functions */
interface FunctionAstNode extends AstNode {
    id : IdentifierAstNode;	// Can be null.
    params : PatternAstNode [];
    defaults : ExpressionAstNode [];
    rest : IdentifierAstNode;	// Can be null.
    body : AstNode;	// Actually it can be BlockStatementAstNode or ExpressionAstNode.
	/* true when this function contains a yield expression
	 * in its body (other than in a nested function). */
    generator : boolean;
	// true when the function is an expression closure and the body field is an expression.
    expression : boolean;
}

/* Statements:
 * spec: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API#Statements */
interface StatementAstNode extends AstNode {}
interface EmptyStatementAstNode extends StatementAstNode {}
interface BlockStatementAstNode extends StatementAstNode {
    body : StatementAstNode [];
}

interface ExpressionStatementAstNode extends StatementAstNode {
    expression : ExpressionAstNode;
}

interface IfStatementAstNode extends StatementAstNode {
    test : ExpressionAstNode;
    consequent : StatementAstNode;
    alternate : StatementAstNode;	// Can be null.
}

interface LabeledStatementAstNode extends StatementAstNode {
    label : IdentifierAstNode;
    body : StatementAstNode;
}

interface BreakStatementAstNode extends StatementAstNode {
    label : IdentifierAstNode;	// Can be null.
}

interface ContinueStatementAstNode extends StatementAstNode {
    label : IdentifierAstNode;	// Can be null.
}

interface WithStatementAstNode extends StatementAstNode {
    object : ExpressionAstNode;
    body : StatementAstNode;
}

interface SwitchStatementAstNode extends StatementAstNode {
    discriminant : ExpressionAstNode;
    cases : SwitchCaseAstNode [];
	/* Flag indicating whether the switch statement
	 * contains any unnested let declarations
	 * (and therefore introduces a new lexical scope). */
    lexical : boolean;
}

interface ReturnStatementAstNode extends StatementAstNode {
    argument : ExpressionAstNode;	// Can be null.
}

interface ThrowStatementAstNode extends StatementAstNode {
    argument : ExpressionAstNode;
}

interface TryStatementAstNode extends StatementAstNode {
    block : BlockStatementAstNode;
    handlers : CatchClauseAstNode [];
    guardedHandlers : CatchClauseAstNode [];
    finalizer : BlockStatementAstNode;	// Can be null.
}

interface WhileStatementAstNode extends StatementAstNode {
    test : ExpressionAstNode;
    body : StatementAstNode;
}

interface DoWhileStatementAstNode extends StatementAstNode {
    body : StatementAstNode;
    test : ExpressionAstNode;
}

interface ForStatementAstNode extends StatementAstNode {
    init : AstNode;	// Actually VariableDeclarationAstNode or ExpressionAstNode. Can be null.
    test : ExpressionAstNode;	// Can be null.
    update : ExpressionAstNode;	// Can be null.
    body : StatementAstNode;
}

interface ForInStatementAstNode extends StatementAstNode {
    left : AstNode;	// Actually VariableDeclarationAstNode or ExpressionAstNode.
    right : ExpressionAstNode;
    body : StatementAstNode;
	// If true, then this is for-each statement.
    each : boolean;
}

interface ForOfStatementAstNode extends StatementAstNode {
    left : AstNode;	// Actually VariableDeclarationAstNode or ExpressionAstNode.
    right : ExpressionAstNode;
    body : StatementAstNode;
}

interface LetStatementAstNode extends StatementAstNode {
    head : { id : PatternAstNode; init : ExpressionAstNode; /* Can be null. */ } [];
    body : StatementAstNode;
}

interface DebuggerStatementAstNode extends StatementAstNode {}

/* Declarations:
 * spec: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API#Declarations */
interface DeclarationAstNode extends StatementAstNode {}

interface FunctionDeclarationAstNode extends FunctionAstNode, DeclarationAstNode {
    id : IdentifierAstNode;	// Note: this field can't be null.
    params : PatternAstNode [];
    defaults : ExpressionAstNode [];
    rest : IdentifierAstNode;	// Can be null.
    body : AstNode;	// Actually it can be BlockStatementAstNode or ExpressionAstNode.
	/* true when this function contains a yield expression
	 * in its body (other than in a nested function). */
    generator : boolean;
	// true when the function is an expression closure and the body field is an expression.
    expression : boolean;
}

interface VariableDeclarationAstNode extends DeclarationAstNode {
    declarations : VariableDeclaratorAstNode [];
    kind : string;	// Can be "var" | "let" | "const".
}

interface VariableDeclaratorAstNode extends AstNode {
    id : PatternAstNode;
    init : ExpressionAstNode;	// Can be null.
}

/* Expressions:
 * spec: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API#Expressions */
interface ExpressionAstNode extends AstNode, PatternAstNode {}
interface ThisExpressionAstNode extends ExpressionAstNode {}
interface ArrayExpressionAstNode extends ExpressionAstNode {
    elements : ExpressionAstNode [];	// Any element can be null.
}

interface ObjectExpressionAstNode extends ExpressionAstNode {
	properties : PropertyAstNode [];
}

interface FunctionExpressionAstNode extends FunctionAstNode, ExpressionAstNode {
    id : IdentifierAstNode;	// Can be null.
    params : PatternAstNode [];
    defaults : ExpressionAstNode [];
    rest : IdentifierAstNode;	// Can be null.
    body : AstNode;	// Actually it can be BlockStatementAstNode or ExpressionAstNode.
	/* true when this function contains a yield expression
	 * in its body (other than in a nested function). */
    generator : boolean;
	// true when the function is an expression closure and the body field is an expression.
    expression : boolean;
}

interface ArrowExpressionAstNode extends FunctionAstNode, ExpressionAstNode {
    params : PatternAstNode [];
    defaults : ExpressionAstNode [];
    rest : IdentifierAstNode;	// Can be null.
    body : AstNode;	// Actually it can be BlockStatementAstNode or ExpressionAstNode.
	/* true when this function contains a yield expression
	 * in its body (other than in a nested function). */
    generator : boolean;
	// true when the function is an expression closure and the body field is an expression.
    expression : boolean;
}

interface SequenceExpressionAstNode extends ExpressionAstNode {
    expressions : ExpressionAstNode;
}

interface UnaryExpressionAstNode extends ExpressionAstNode {
    operator : string;	// Can be "-" | "+" | "!" | "~" | "typeof" | "void" | "delete".
    prefix : boolean;
    argument : ExpressionAstNode;
}

interface BinaryExpressionAstNode extends ExpressionAstNode {
	/* Can be "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" |
	 * ">=" | "<<" | ">>" | ">>>" | "+" | "-" | "*" | "/" | "%"
	 * | "|" | "^" | "in" | "instanceof". */
    operator : string;
    left : ExpressionAstNode;
    right : ExpressionAstNode;
}

interface AssignmentExpressionAstNode extends ExpressionAstNode {
	/* Can be "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "<<=" |
	 * ">>=" | ">>>=" | "|=" | "^=" | "&=". */
    operator : string;
    left : ExpressionAstNode;
    right : ExpressionAstNode;
}

interface UpdateExpressionAstNode extends ExpressionAstNode {
    operator : string;	// Can be "++" | "--".
    argument : ExpressionAstNode;
    prefix : boolean;
}

interface LogicalExpressionAstNode extends ExpressionAstNode {
    operator : string;	// Can be "||" | "&&".
    left : ExpressionAstNode;
    right : ExpressionAstNode;
}

interface ConditionalExpressionAstNode extends ExpressionAstNode {
    test : ExpressionAstNode;
    alternate : ExpressionAstNode;
    consequent : ExpressionAstNode;
}

interface NewExpressionAstNode extends ExpressionAstNode {
    callee : ExpressionAstNode;
    arguments : ExpressionAstNode [];
}

interface CallExpressionAstNode extends ExpressionAstNode {
    callee : ExpressionAstNode;
    arguments : ExpressionAstNode [];
}

interface MemberExpressionAstNode extends ExpressionAstNode {
    object : ExpressionAstNode;
    property : ExpressionAstNode;	// Actually it can be IdentifierAstNode or ExpressionAstNode;
	/* If computed === true, the node corresponds to a computed e1[e2] expression
	 * and property is an ExpressionAstNode. If computed === false, the node corresponds to
	 * a static e1.x expression and property is an IdentifierAstNode. */
    computed : boolean;
}

interface YieldExpressionAstNode extends ExpressionAstNode {
    argument : ExpressionAstNode;	// Can be null.
}

interface ComprehensionExpressionAstNode extends ExpressionAstNode {
    body : ExpressionAstNode;
	// Corresponds to the sequence of for and for each blocks.
    blocks : ComprehensionBlockAstNode [];
	// Optional filter expression corresponds to the final if clause, if present.
    filter : ExpressionAstNode;	// Can be null.
}

interface GeneratorExpressionAstNode extends ExpressionAstNode {
    body : ExpressionAstNode;
    // Corresponds to the sequence of for and for each blocks.
    blocks : ComprehensionBlockAstNode [];
	// Optional filter expression corresponds to the final if clause, if present.
    filter : ExpressionAstNode;	// Can be null.
}

// Note: GraphExpression and GraphIndexExpression are obsolete.

interface LetExpressionAstNode extends ExpressionAstNode {
    head: VariableDeclaratorAstNode [];
    body : ExpressionAstNode;
}

/* Patterns:
 * spec: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API#Patterns */
interface PatternAstNode extends AstNode {}

interface ObjectPatternAstNode extends PatternAstNode {
    properties : PropertyPatternAstNode [];
}

interface PropertyPatternAstNode extends AstNode {
	// A literal key can have either a string or number as its value.
	key : ExpressionAstNode;	// Actually it can be Literal or Identifier.
	value : PatternAstNode;
}

interface ArrayPatternAstNode extends PatternAstNode {
    elements : PatternAstNode [];	// Any element can be null.
}

/* Clauses:
 * spec: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API#Clauses */
interface SwitchCaseAstNode extends AstNode {
    test : ExpressionAstNode;	// Can be null.
    consequent : StatementAstNode [];
}

interface CatchClauseAstNode extends AstNode {
    param : PatternAstNode;
    guard : ExpressionAstNode;	// Can be null.
    body : BlockStatementAstNode;
}

interface ComprehensionBlockAstNode extends AstNode {
    left : PatternAstNode;
    right : ExpressionAstNode;
    each : boolean;
}

/* Miscellaneous:
 * spec: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API#Miscellaneous */
interface IdentifierAstNode extends AstNode, ExpressionAstNode, PatternAstNode {
    name : string;
}

interface LiteralAstNode extends AstNode, ExpressionAstNode {
    value : any;	// Can be: string, boolean, null, number or RegExp.
}

interface PropertyAstNode extends AstNode {
	// A literal key can have either a string or number as its value.
	key : ExpressionAstNode;	// Actually it can be LiteralAstNode or IdentifierAstNode.
    value : ExpressionAstNode;
    kind : string;	// Can be "init" | "get" | "set".
}