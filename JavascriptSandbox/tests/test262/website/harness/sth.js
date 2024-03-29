/// Copyright (c) 2012 Ecma International.  All rights reserved. 
/// Ecma International makes this code available under the terms and conditions set
/// forth on http://hg.ecmascript.org/tests/test262/raw-file/tip/LICENSE (the 
/// "Use Terms").   Any redistribution of this code must retain the above 
/// copyright and this notice and otherwise comply with the Use Terms.

// Do not cache any JSON files - see
// https://bugs.ecmascript.org/show_bug.cgi?id=87
$.ajaxSetup( {cache:false});

/*
 * Run a test in the browser. Works by injecting an iframe with the test code.
 *
 * Public Methods:
 * * run(id, test): Runs the test specified.
 *
 * Callbacks:
 * * onComplete(test): Called when the test is run. Test object
 *                     contains result and error strings describing how the
 *                     test ran.
 */
function BrowserRunner() {
    var iframe,             // injected iframe
        currentTest,        // Current test being run.
        scriptCache = {},   // Holds the various includes required to run certain tests.
        instance    = this,
        errorDetectorFileContents,
        simpleTestAPIContents,
        globalScopeContents,
        harnessDir = "harness/";

    $.ajax({async: false,
            dataType: "text",
            success: function(data){errorDetectorFileContents = data;},
            url:harnessDir+"ed.js"});

    $.ajax({async: false,
            dataType: "text",
            success: function(data){simpleTestAPIContents = data;},
            url:harnessDir+"sta.js"});

    $.ajax({async: false,
            dataType: "text",
            success: function(data){globalScopeContents = data;},
            url:harnessDir+"gs.js"});

    /* Called by the child window to notify that the test has
     * finished. This function call is put in a separate script block
     * at the end of the page so errors in the test script block
     * should not prevent this function from being called.
     */
    function testFinished() {
        if((typeof currentTest.result) === "undefined") {
            // We didn't get a call to testRun, which likely means the
            // test failed to load.
            currentTest.result = "fail";
            currentTest.error  = "Failed to load test case (probable parse error).";
            currentTest.description = "Failed to load test case!";
        } else if((typeof currentTest.error) !== "undefined") {
            // We have an error logged from testRun.
            if(currentTest.error instanceof Test262Error) {
                currentTest.error = currentTest.message;
            } else {
            currentTest.error = currentTest.error.name + ": " + currentTest.error.message;
            }
        } else if ((typeof currentTest.error === "undefined") && (currentTest.result === "fail")) {
            currentTest.error = "Test case returned non-true value.";
        }

        document.body.removeChild(iframe);

        instance.onComplete(currentTest);
    }

    /* Called from the child window after the test has run. */
    function testRun(id, path, description, codeString, result, error) {
        currentTest.id = id;
        currentTest.path = path;
        currentTest.description = description;
        currentTest.result = result;
        currentTest.error = error;
        currentTest.code = codeString;
    }


    /* Run the test. */
    this.run = function (test, code) {
        var start = new Date();
        
        //--Detect proper window.onerror support
        if (instance.supportsWindowOnerror===undefined) {
            var iframePrereqs = document.createElement("iframe");
            iframePrereqs.setAttribute("id", "prereqsIframe");
            if (!/firefox/i.test(navigator.userAgent)) {
                iframePrereqs.setAttribute("style", "display:none");
            }
            document.body.appendChild(iframePrereqs);

            var iwinPrereqs = iframePrereqs.contentWindow; 
            var idocPrereqs = iwinPrereqs.document;
            idocPrereqs.open();
    
            iwinPrereqs.failCount = 0;
            
            var stuff = [
                         "window.onerror = function(a, b, c) { this.failCount++; }",
                         "va xyz =",
                         "throw Error();"
            ];
    
            for(var i in stuff) {
                idocPrereqs.writeln("<script type='text/javascript'>");
                idocPrereqs.writeln(stuff[i]);
                idocPrereqs.writeln("</script>");
            }
            idocPrereqs.close();
            
            //TODO - 500ms *should* be a sufficient delay
            setTimeout(function() {
                instance.supportsWindowOnerror = iwinPrereqs.failCount === 2;
                //alert(iwinPrereqs.failCount);
                document.body.removeChild(iframePrereqs);
                instance.run(test, code);
            }, 500);
            return 0; // initial config, ignore this timing.
        }
        
        currentTest = {};
        for (var tempIndex in test) {
            if (test.hasOwnProperty(tempIndex)) {
                currentTest[tempIndex] = test[tempIndex];
            }
        }
        currentTest.code = code;

		//console.log (
		//	'Test "' + currentTest.id + '" ' +
		//	currentTest.path + '\n' +
		//	'Description: "' + currentTest.description + '"\n'
		//);

        iframe = document.createElement("iframe");
        iframe.setAttribute("id", "runnerIframe");
        //FireFox has a defect where it doesn't fire window.onerror for an iframe if the iframe
        //is invisible.
        if (!/firefox/i.test(navigator.userAgent)) {
            iframe.setAttribute("style", "display:none");
        }
        document.body.appendChild(iframe);

        var iwin = window.frames[window.frames.length - 1];
        var idoc = iwin.document;
        idoc.open();

        // Set up some globals.
        iwin.testRun = testRun;
        iwin.testFinished = testFinished;

        //TODO: these should be moved to sta.js
        var includes = code.match(/\$INCLUDE\(([^\)]+)\)/g), // find all of the $INCLUDE statements
            include;

        if (includes !== null) {
            // We have some includes, so loop through each include and
            // pull in the dependencies.
            for (var i = 0; i < includes.length; i++) {
                include = includes[i].replace(/.*\(('|")(.*)('|")\)/, "$2");

                // First check to see if we have this script cached
                // already, and if not, grab it.
                if (typeof scriptCache[include] === "undefined") {
                    $.ajax({
                        async: false,
                        url: 'harness/' + include,
                        success: function (s) { scriptCache[include] = s; }
                    });
                }

                // Finally, write the required script to the window.
                idoc.writeln("<script type='text/javascript'>" + scriptCache[include] + "</script>");
            }
        }

        //Write out all of our helper functions
        //idoc.writeln("<script type='text/javascript' src='harness/sta.js'>" + "</script>");
        idoc.writeln("<script type='text/javascript'>");
        idoc.writeln(simpleTestAPIContents);
        idoc.writeln("</script>");

        iwin.iframeError = undefined;
        iwin.onerror = undefined;
        iwin.testDescrip = currentTest;

        //Add an error handler capable of catching so-called early errors
        //idoc.writeln("<script type='text/javascript' src='harness/ed.js'>" + "</script>");
        idoc.writeln("<script type='text/javascript'>");
        idoc.writeln(errorDetectorFileContents);
        idoc.writeln("</script>");

		function runWithRuntime () {
			idoc.writeln ( '<script src="../../../System.js"></script>' );
			idoc.writeln ( '<script src="../../../Configuration.js"></script>' );

			idoc.writeln ( '<script src="../../../syntax/lexer/TokenType.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/lexer/Token.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/lexer/NumericTokenKind.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/lexer/NumericToken.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/lexer/StringTokenKind.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/lexer/StringToken.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/lexer/IdentifierKind.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/lexer/IdentifierToken.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/lexer/RegexToken.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/lexer/Punctuator.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/lexer/PunctuatorToken.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/lexer/CommentNode.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/lexer/Lexer.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/parser/Parser.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/parser/StatementParser.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/parser/OpPrecedence.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/parser/ExpressionParser.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/parser/FunctionParser.js"></script>' );
			idoc.writeln ( '<script src="../../../syntax/parser/DefaultAstBuilder.js"></script>' );

			idoc.writeln ( '<script src="../../../Runtime.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/RstNode.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/ScopeNode.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/Identifier.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/Literal.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/Program.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/VariableDeclaration.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/VariableDeclarator.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/AssignmentExpression.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/ExpressionStatement.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/MemberExpression.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/UpdateExpression.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/BinaryExpression.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/LogicalExpression.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/ThisExpression.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/SequenceExpression.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/UnaryExpression.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/ArrayExpression.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/ObjectExpression.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/Property.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/BlockStatement.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/DoWhileStatement.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/WhileStatement.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/LabeledStatement.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/BreakStatement.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/ContinueStatement.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/EmptyStatement.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/ForStatement.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/ForInStatement.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/IfStatement.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/ConditionalExpression.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/SwitchStatement.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/SwitchCase.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/InvocationNode.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/CallExpression.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/NewExpression.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/FunctionNode.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/FunctionExpression.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/FunctionDeclaration.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/ReturnStatement.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/ThrowStatement.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/TryStatement.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/CatchClause.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/WithStatement.js"></script>' );
			idoc.writeln ( '<script src="../../../rst/RstBuilder.js"></script>' );
			idoc.writeln ( '<script src="../../../RuntimeScope.js"></script>' );
			idoc.writeln ( '<script src="../../../StackFrame.js"></script>' );

			idoc.writeln ( '<script src="../RuntimeEntryPoint.js"></script>' );

			//Run the code
			var containsRunFunc = code.indexOf ( 'runTestCase' );

			if ( containsRunFunc !== -1 ) {
				code += '\nfunction runTestCase(testcase) {\n\
		if (testcase() !== true) {\n\
			$ERROR("Test case returned non-true value!");\n\
		}\n\
	}\n';
			}

			idoc.writeln ( "<script type='text/javascript'>" );
			idoc.writeln (
				"RuntimeEntryPoint ( \"" +
				this.convertForEval ( code ) +
				"\" );"
			);
			idoc.writeln ( "</script>" );
		}

		function runNative () {
			//Run the code
			idoc.writeln("<script type='text/javascript'>");
			if (! instance.supportsWindowOnerror) {
			    idoc.writeln("try {eval(\"" + this.convertForEval(code) + "\");} catch(e) {window.onerror(e.toString(), null, null);}");
			} else {
			    idoc.writeln(code);
			}
			idoc.writeln("</script>");
		}

		runWithRuntime.call ( this );
		//runNative.call ( this );

        //Validate the results
        //idoc.writeln("<script type='text/javascript' src='harness/gs.js' defer>" + "</script>");
        idoc.writeln("<script type='text/javascript'>");
        idoc.writeln(globalScopeContents);
        idoc.writeln("</script>");
        idoc.close();
        
        var elapsed = new Date() - start;

        return elapsed;
    };

    //--Helper functions-------------------------------------------------------
    this.convertForEval = function(txt) {
        txt = txt.replace(/\\/g,"\\\\");
        txt = txt.replace(/\"/g,"\\\"");
        txt = txt.replace(/\'/g,"\\\'");
        txt = txt.replace(/\r/g,"\\r");
        txt = txt.replace(/\n/g,"\\n");
        return txt;
    };
}

var useTestFilter = false;
// Previous stats:
// Tests To run: 11573 | Total tests ran: 597 | Pass: 0 | Fail: 597 | Failed to load: 0
// Tests To run: 11573 | Total tests ran: 11573 | Pass: 11333 | Fail: 240 | Failed to load: 0, 197 "with statement is not supported" erros.
// Tests To run: 11573 | Total tests ran: 11573 | Pass: 11501 | Fail: 72 | Failed to load: 0
// Tests To run: 11573 | Total tests ran: 11573 | Pass: 11552 | Fail: 21 | Failed to load: 0
// Current stats:
// Tests To run: 11573 | Total tests ran: 11573 | Pass: 11555 | Fail: 18 | Failed to load: 0
var testFilter = ["TestCases/ch10/10.6/10.6-10-c-ii-1.js", "TestCases/ch10/10.6/10.6-10-c-ii-2.js", "TestCases/ch15/15.12/15.12.2/S15.12.2_A1.js", "TestCases/ch15/15.2/15.2.3/15.2.3.6/15.2.3.6-4-292-1.js", "TestCases/ch15/15.2/15.2.3/15.2.3.6/15.2.3.6-4-293-2.js", "TestCases/ch15/15.2/15.2.3/15.2.3.6/15.2.3.6-4-293-3.js", "TestCases/ch15/15.2/15.2.3/15.2.3.6/15.2.3.6-4-294-1.js", "TestCases/ch15/15.2/15.2.3/15.2.3.6/15.2.3.6-4-295-1.js", "TestCases/ch15/15.2/15.2.3/15.2.3.6/15.2.3.6-4-296-1.js", "TestCases/ch15/15.5/15.5.4/15.5.4.9/S15.5.4.9_A6.js", "TestCases/ch15/15.5/15.5.4/15.5.4.9/S15.5.4.9_A7.js", "TestCases/ch15/15.8/15.8.2/15.8.2.8/S15.8.2.8_A6.js", "TestCases/ch15/15.9/15.9.3/S15.9.3.1_A5_T1.js", "TestCases/ch15/15.9/15.9.3/S15.9.3.1_A5_T2.js", "TestCases/ch15/15.9/15.9.3/S15.9.3.1_A5_T3.js", "TestCases/ch15/15.9/15.9.3/S15.9.3.1_A5_T4.js", "TestCases/ch15/15.9/15.9.3/S15.9.3.1_A5_T5.js", "TestCases/ch15/15.9/15.9.3/S15.9.3.1_A5_T6.js"];
/* I getting strange results from this test under Chrome: sometimes it fails and sometimes it's not.
 * But when I run this test individually, it always pass. */
//var testFilter = ["TestCases/ch08/8.5/S8.5_A2.1.js"];
// Individual test filter:
//var testFilter = ["TestCases/ch08/8.5/S8.5_A2.1.js"];

// Chrome native test results: Tests To run: 11573 | Total tests ran: 11573 | Pass: 11558 | Fail: 15 | Failed to load: 0
// List of failed tests below:
//var testFilter = ["TestCases/ch11/11.2/11.2.3/11.2.3-3_3.js", "TestCases/ch15/15.12/15.12.2/S15.12.2_A1.js", "TestCases/ch15/15.5/15.5.4/15.5.4.9/S15.5.4.9_A11.js", "TestCases/ch15/15.5/15.5.4/15.5.4.9/S15.5.4.9_A6.js", "TestCases/ch15/15.5/15.5.4/15.5.4.9/S15.5.4.9_A7.js", "TestCases/ch15/15.8/15.8.2/15.8.2.8/S15.8.2.8_A6.js", "TestCases/ch15/15.9/15.9.3/S15.9.3.1_A5_T1.js", "TestCases/ch15/15.9/15.9.3/S15.9.3.1_A5_T2.js", "TestCases/ch15/15.9/15.9.3/S15.9.3.1_A5_T3.js", "TestCases/ch15/15.9/15.9.3/S15.9.3.1_A5_T4.js", "TestCases/ch15/15.9/15.9.3/S15.9.3.1_A5_T5.js", "TestCases/ch15/15.9/15.9.3/S15.9.3.1_A5_T6.js", "TestCases/ch15/15.9/15.9.5/15.9.5.5/S15.9.5.5_A2_T1.js", "TestCases/ch15/15.9/15.9.5/15.9.5.6/S15.9.5.6_A2_T1.js", "TestCases/ch15/15.9/15.9.5/15.9.5.7/S15.9.5.7_A2_T1.js"];

/* Loads tests from the sections specified in testcases.json.
 * Public Methods:
 * * getNextTest() - Start loading the next test.
 * * reset() - Start over at the first test.
 *
 * Callbacks:
 * * onLoadingNextSection(path): Called after a request is sent for the next section json, with the path to that json.
 * * onInitialized(totalTests): Called after the testcases.json is loaded and parsed.
 * * onTestReady(id, code): Called when a test is ready with the
 *       test's id and code.
 * * onTestsExhausted(): Called when there are no more tests to run.
 */
function TestLoader() {
    var testGroups       = [],
        testGroupIndex   = 0,
        currentTestIndex = 0,
        loader           = this,
        mode             = "all";

    this.loadedFiles = 0;
    this.version     = undefined;
    this.date        = undefined;
    this.totalTests  = 0;
    this.runningTests = 0;

    /* Get the XML for the next section */
    function getNextXML() {
        currentTestIndex = 0;

        // already loaded this section.
        if(testGroups[testGroupIndex].status == 'loaded') {
            testGroups[testGroupIndex].onLoaded = function(){};
            loader.getNextTest();
            return;
        }
        // not loaded, so we attach a callback to come back here when the file loads.
        else {
            presenter.updateStatus("Loading file: " + testGroups[testGroupIndex].path);
            testGroups[testGroupIndex].onLoaded = getNextXML;
            
        }
    }
    
    /* Get the test list xml */
    function loadTestXML() {
        var testsListLoader = new XMLHttpRequest();

        $.ajax({url: TEST_LIST_PATH, dataType: 'json', success: function(data) {
            var testSuite = data.testSuite;

            loader.version    = data.version;
            loader.date       = data.date;
            loader.totalTests = data.numTests;

            for (var i = 0; i < testSuite.length; i++) {
                testGroups[i] = {
                    path: testSuite[i],
                    tests: [],
                    selected: false,
                    status: 'waiting',
                    onLoaded: function(){}
                };
                presenter.setTestWaiting(i, testSuite[i]);
                
                var tr = $('#chapterSelector table tr').filter(':nth-child(' + (i+1) + ')');
                tr.find('img').filter('[alt="Run"]').bind('click', {index:i}, function(event){
                    controller.runIndividualTest(event.data.index);
                });
            }
            loader.onInitialized(loader.totalTests);
            getFile();
        }});
    }
    
    /* Get the test file. Handles all the logic of figuring out the next file to load. */
    function getFile(index) {
        index = (arguments.length == 0) ? -1 : index;
        
        // Look for selected waiting chapters (priority because you'll probably want to run them soon)
        for(var i = 0; index == -1 && i < testGroups.length; i++) {
            if(testGroups[i].status == 'waiting' && testGroups[i].selected) {
                index = i;
            }
        }
        
        // Look for just chapters waiting to be loaded.
        for(var i = 0; index == -1 && i < testGroups.length; i++) {
            if(testGroups[i].status == 'waiting') {
                index = i;
            }
        }
            
        if(index == -1) {
            // Still -1? No more tests are waiting to be loaded then.
            if(controller.state == 'loading') {
                presenter.setState('loaded');
            }
            return;
        }
        
        presenter.setTestLoading(index, testGroups[index].path);
        // the only other status that should be set when we get here is 'priorityloading'
        if(testGroups[index].status == 'waiting') {
            testGroups[index].status = 'loading';
        }
        
        loader.onTestStartLoading(index, testGroups[index].path);
        // Create the AJAX call to grab the file.
        $.ajax({
            url: testGroups[index].path,
            dataType: 'json',
            // Callback with the chapter name and number of tests.
            success: function(data, status, xhr) {
                // Save the data for later usage
                testGroups[index].tests = data.testsCollection.tests;
                onTestLoaded(index, data.testsCollection.name, data.testsCollection.tests.length);
            },
            error: function(xhr, textStatus, errorThrown) {
                // TODO: Catch this error and update UI accordingly. Unlikely to happen, but errors would be 404 or 5-- errors.
                
            }
        });
    }
    
    /* Executes when a test file finishes loading. */
    function onTestLoaded(index, name, numTests) {
        presenter.setTestLoaded(index, name, numTests);

        if(testGroups[index].selected && mode == "multiple") {
            loader.runningTests += numTests;
            loader.onInitialized( loader.runningTests );
        }
        
        // The loading status is only assigned when downloading files in sequence, otherwise it
        // gets the status of priorityloading. When loading out of order, we only want to download
        // the single file, so we'll only tell it to get the next file when we see a status of
        // loading.
        if(testGroups[index].status == 'loading') {
            getFile(); // triggers downloading the next file
            testGroups[index].status = 'loaded';
        }
        else if(testGroups[index].status == 'priorityloading') {
            // Run the test
            testGroups[index].status = 'loaded';
            loader.setChapter(index);
        }
        
        testGroups[index].onLoaded();
    };
    
    function getIdFromPath (path) {
        //path is of the form "a/b/c.js"

        var id = path.split("/");
        //id is now of the form ["a", "b", "c.js"];

        id = id[id.length-1];
        //id is now of the form "c.js"

        id = id.replace(/\.js$/i, "");
        //id is now of the form "c"

        return id;
    }

    /* Move on to the next test */
    this.getNextTest = function() {
        // If the file is loaded
        if(testGroups[testGroupIndex].status == "loaded")
        {
			var testFound = false;
            // And if we have tests left in this file
            while (currentTestIndex < testGroups[testGroupIndex].tests.length) {
                // Run the next test
                var test = testGroups[testGroupIndex].tests[currentTestIndex++];

				if ( useTestFilter && -1 === testFilter.indexOf ( test.path ) )
					continue;

                var scriptCode = test.code;
                test.id = getIdFromPath(test.path);

                loader.onTestReady(test, $.base64Decode(scriptCode));
				testFound = true;
				break;
            }

			if ( !testFound ) {
				// If there are no tests left and we aren't just running one file
				if(testGroupIndex < testGroups.length - 1 && mode !== "one") {
					// And if we are running multiple chapters
					if(mode == "multiple") {
						var i = testGroupIndex + 1;
						testGroupIndex = -1;
						for(; i < testGroups.length && testGroupIndex == -1; i++) {
							if(testGroups[i].selected === true) {
								testGroupIndex = i;
							}
						}
						if(testGroupIndex == -1) { // we couldn't find a test we haven't run yet
							loader.onTestsExhausted();
							return;
						}
					}
					// And if 
					else {
						// We don't have tests left in this test group, so move on
						// to the next.
						testGroupIndex++;
					}
					getNextXML();
				}
				// 
				else {
					// We're done.
					loader.onTestsExhausted();
				}
			}
        }
        else {
            presenter.updateStatus("Loading test file: " + testGroups[testGroupIndex].path);
            testGroups[testGroupIndex].onLoaded = getNextXML;
        }
    };

    /* Reset counters that track the next test (so we test from the beginning) */
    this.reset = function() {
        mode = "all";
        currentTestIndex = 0;
        testGroupIndex = 0;
    };
    
    /* Begin downloading test files. */
    this.startLoadingTests = function() {
        loadTestXML();
    };
    
    /* Prepare for testing a single chapter. */
    this.setChapter = function(index) {
        currentTestIndex = 0;
        testGroupIndex = index;
        mode = "one";
        
        if(testGroups[index].status == 'loaded') {
            loader.onInitialized(testGroups[index].tests.length);
        }
        else {
            testGroups[index].status = 'priorityloading';
            getFile(index);
            loader.onInitialized(0);
        }
    };
    
    /* Prepare for testing multiple chapters. Returns true if at least one chapter was selected. */
    this.setMultiple = function() {
        // Find the index of the first selection
        var firstSelectedIndex = -1;
        for(var i = 0; firstSelectedIndex == -1 && i < testGroups.length; i++) {
            if(testGroups[i].selected) {
                firstSelectedIndex = i;
            }
        }
        // If we didn't find a selected index, just quit.
        if(firstSelectedIndex == -1) {
            return false;
        }
        
        // Begin loading the file immediately, if necessary
        if(testGroups[firstSelectedIndex].status == 'waiting') {
            getFile(firstSelectedIndex);
        }
    
        mode = "multiple";
        testGroupIndex = firstSelectedIndex; // start at this chapter
        currentTestIndex = 0; // start at test 0
        
        // Count the number of tests
        runningTests = 0;
        for(var i = 0; i < testGroups.length; i++) {
            runningTests += (testGroups[i].selected && testGroups[i].status == 'loaded') ? testGroups[i].tests.length : 0;
        }
        loader.onInitialized(runningTests);
        return true;
    };
    
    this.getNumTestFiles = function() {
        return testGroups.length;
    };
    
    /* Toggle the selection of a file. */
    this.toggleSelection = function(index) {
        testGroups[index].selected = !testGroups[index].selected;
    }
    
}

/* Controls test generation and running, and sends results to the presenter. */
function Controller() {
    var state  = 'undefined';
    var runner = new BrowserRunner();
    var loader = new TestLoader();
    var controller = this;
    var startTime;
    var elapsed = 0;
	var failedTestPaths = [];
    //Hook which allows browser implementers to hook their own test harness API
    //into this test framework to handle test case failures and passes in their
    //own way (e.g., logging failures to the filesystem)
    this.implementerHook = {
        //Adds a test result
        addTestResult: function (test) {
			if ( test.result === 'fail' ) {
				//console.log ( 'FAIL: "' + test.path + '"' );
				failedTestPaths.push ( test.path );
			}
		},

        //Called whenever all tests have finished running.  Provided with the
        //elapsed time in milliseconds.
        finished: function(elapsed) {
			var failedTestPathsStr = failedTestPaths
				.map ( function ( path ) { return	'"' + path + '"'; } )
				.join ( ', ' );

			failedTestPathsStr = 'var testFilter = [' + failedTestPathsStr + '];';

			var resElt = document.createElement ( 'div' );
			resElt.style.fontFamily = 'Monospace';
			resElt.innerText = failedTestPathsStr;
			document.body.appendChild ( resElt );
		}
    };

    /* Executes when a test case finishes executing. */
    runner.onComplete = function(test) {
        presenter.addTestResult(test);
        try {
            controller.implementerHook.addTestResult(test);
        } catch(e) { /*no-op*/}

        if(state === 'running') {
            setTimeout(loader.getNextTest, 10);
        }
    };

    /* Executes when the loader has been initialized. */
    loader.onInitialized = function(totalTests) {
        if(arguments.length == 0) {
            totalTests = loader.totalTests;
        }
        presenter.setTotalTests(totalTests);
    };
    
    /* Executes when a test file starts loading. */
    loader.onTestStartLoading = function(index, path) {
        presenter.setTestLoading(index, path);
    }

    /* Executes when a test is ready to run. */
    loader.onTestReady = function(testObj, testSrc) {
        presenter.updateStatus("Running Test: " + testObj.id);
        elapsed += runner.run(testObj, testSrc);
    };

    /* Executes when there are no more tests to run. */
    loader.onTestsExhausted = function() {
        elapsed = elapsed/(1000*60);  //minutes
        elapsed = elapsed.toFixed(3);
        
        state = (loader.loadedFiles == loader.getNumTestFiles()) ? 'loaded' : 'loading';
        presenter.setState(state);
        presenter.finished(elapsed);
        try {
            controller.implementerHook.finished(elapsed);
        } catch(e) { /*no-op*/}
    };
    
    /* Start the test execution. */
    this.start = function() {
        elapsed = 0;
        state = 'running';
        presenter.setState(state);
        loader.getNextTest();
    };

    /* Pause the test execution. */
    this.pause = function() {
        state = 'paused';
        presenter.setState(state);
    };

    /* Reset the testing status. */
    this.reset = function() {
        loader.onInitialized();
        loader.reset();
        presenter.reset();
        
        state = (loader.loadedFiles == loader.getNumTestFiles()) ? 'loaded' : 'loading';
        presenter.setState(state);
		failedTestPaths = [];
    };
    
    /* Start loading tests. */
    this.startLoadingTests = function() {
        state = 'loading';
        presenter.setState(state);
        loader.startLoadingTests();
    }
    
    /* Set the individual chapter in the laoder and start the controller. */
    this.runIndividualTest = function(index) {
        controller.reset();
        loader.setChapter(index);
        controller.start();
    }
    
    /* Compile a list of the selected tests and start the controller. */
    this.runSelected = function() {
        controller.reset();
        if(loader.setMultiple()) {
            controller.start();
        }
    }
    
    this.runAll = function() {
        controller.reset();
        controller.start();
    }
    
    this.toggleSelection = function(index) {
        loader.toggleSelection(index);
    }
}

var controller = new Controller();

/* Helper function which shows if we're in the 'debug' mode of the Test262 site.
   This mode is only useful for debugging issues with the test harness and
   website. */
function isSiteDebugMode() {
    var str=window.location.href.substring(window.location.href.indexOf("?")+1);
    if(str.indexOf("sitedebug") > -1) {
        return true;
    }
    else {
        return false;
    }
}


$(function () {
    presenter.setup();
    $('.content-home').show();
    // Adding attribute to the tabs (e.g. Home, Run etc.) and
    // attaching the click event on buttons (e.g. Reset, Start etc.)
    $('.nav-link').each(function (index) {
        //Adding "targetDiv" attribute to the header tab and on that
        //basis the div related to header tabs are displayed
        if (index === 0) {
            $(this).attr('targetDiv', '.content-home');
        } else if (index === 1) {
            $(this).attr('targetDiv', '.content-tests');
        } else if (index === 2) {
            $(this).attr('targetDiv', '.content-results');
            $(this).attr('testRunning', 'false');
        } else if (index === 3) {
            $(this).attr('targetDiv', '.content-dev');
        }
        else {
            $(this).attr('targetDiv', '.content-browsers');
        }

        //Attaching the click event to the header tab that shows the
        //respective div of header
        $(this).click(function () {
            var target = $(this).attr('targetDiv');
            $('#contentContainer > div:visible').hide();
            $('.navBar .selected').toggleClass('selected');
            $(this).addClass('selected');
            $(target).show();

            //If clicked tab is Result, it generates the results.
            if ($(target).hasClass('content-results')) {
                presenter.refresh();
            }
        });
    });

    // Attach click events to all the control buttons.
    $('#btnRunAll').click(controller.runAll);
    $('#btnReset').click(controller.reset);
    $('#btnRunSelected').click(controller.runSelected);
    $('#btnPause').click(controller.pause);
    $('#btnResume').click(controller.start);

    var SUITE_DESCRIP_PATH = "json/suiteDescrip.json";
    $.ajax({ url: SUITE_DESCRIP_PATH, dataType: 'json', success: function (data) {
        presenter.setVersion(data.version);
        presenter.setDate(data.date);
    }
    });
    
    // Start loading the files right away.
    controller.startLoadingTests();

});
