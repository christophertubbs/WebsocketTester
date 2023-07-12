/**
 * The STORAGE key used for storing the last used websocket address
 * Stored Address Key
 * @type {string}
 */
const STORED_ADDRESS_KEY = "address";

/**
 * The STORAGE key used for storing data from the core editor
 * Stored Input Key
 * @type {string}
 */
const STORED_INPUT_KEY = "input";

/**
 * The STORAGE key used for saving user created tabs
 * Saved Tab Key
 * @type {string}
 */
const SAVED_TAB_KEY = "saved_tabs";

/**
 * Prefix used to denote messages. Identifiers for messages should come afterwards
 * @type {string}
 */
const SAVED_MESSAGE_PREFIX = "saved_message:";

/**
 * The maximum number of messages that will be stored. Older messages will be removed to make way for new messages
 * @type {number}
 */
const MAXIMUM_SAVED_MESSAGES = 15;

/**
 * The storage mechanism used to store data
 * @type {Storage}
 */
const STORAGE = localStorage;

/**
 * The prefix for STORAGE entries used to store editor information from user created tabs
 * Extra Storage Key
 * @type {string}
 */
const EXTRA_STORAGE_KEY = "extra_storage_"

/**
 * A regular expression used to find invalid names for variables - those starting with a number or
 * containing characters that aren't alphanumeric
 * Invalid Variable Characters
 * @type {RegExp}
 */
const INVALID_VARIABLE_CHARACTERS = /^[0-9]|[^a-zA-Z0-9_]/g;

/**
 * The primary web socket used to communicate with a server
 * Socket
 * @type {WebSocket}
 */
let socket = null;

/**
 * The read-only editor that presents incoming messages in real-time
 * Receiver
 * @type {CodeMirror}
 */
let receiver = null;

/**
 * The editor used to write JSON messages to send through the websocket
 * Sender
 * @type {CodeMirror}
 */
let sender = null;

/**
 * The mapping between the ID for a div containing a user created editor and its editor
 * Extra Tab Editors
 * @type {Object.<string, CodeMirror>}
 */
let extraTabEditors = {};

/**
 * The JQuery UI tabs widget
 * Tabs
 * @type {Object}
 * @see https://jqueryui.com/tabs/
 */
let tabs = null;

/**
 * The number of scripts added by the user
 * User Script Count
 * @type {number}
 */
let userScriptCount = 0;

/**
 * An array containing a list of the hashes of user created scripts. A new script will not be introduced if its
 * hash is already in the list
 * User Scripts
 * @type {Array<number>}
 */
let userScripts = [];

/**
 * The configuration for the receiver CodeMirror editor
 * Receiver Configuration
 * @type {Object}
 */
const receiverConfig = {
    /** Highlight Javascript Syntax */
    mode: "javascript",
    /** Focus on JSON syntax */
    json: true,
    /** Don't allow user interaction */
    readOnly: true,
    /** Tabs should extend out to 4 spaces */
    indentUnit: 4,
    /** Let the editor continuously scroll within its container */
    viewportMargin: Infinity,
    /** Wrap long lines for readability */
    lineWrapping: true,
    /** Enter and exit fullscreen mode when pressing F11 and exit fullscreen mode by pressing Esc */
    extraKeys: {
        "F11": function(cm) {
            cm.setOption("fullScreen", !cm.getOption("fullScreen"));
        },
        "Esc": function(cm) {
            if (cm.getOption("fullScreen")) {
                cm.setOption("fullScreen", false);
            }
        }
    }
};

/*
 * The configuration used for the Sender CodeMirror editor, along with any new editor that the user adds
 * Sender Configuration
 * @type {Object}
 */
const senderConfig = {
    /** Highlight Javascript Syntax */
    mode: "javascript",
    /** Focus on JSON syntax */
    json: true,
    /** Tabs should extend out to 4 spaces */
    indentUnit: 4,
    /** Show line numbers for each number in a gutter */
    lineNumbers: true,
    /** Perform the lint operation on the contents of this editor */
    lint: {esversion: 2020},
    /** Allow users to drag and drop json files into this editor */
    allowDropFileTypes: ['application/json'],
    /** Let the editor continuously scroll within its container */
    viewportMargin: Infinity,
    /** Highlight the matching bracket for the one the cursor is adjacent to */
    matchBrackets: true,
    /** Insert a close bracket when an open bracket is added */
    autoCloseBrackets: true,
    /** Add folding buttons to the gutter */
    foldGutter: true,
    /** Add the following fields to the gutter */
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter", "CodeMirror-lint-markers"],
    /** Enable the following programmatic commands to the editor */
    commands: [
        "selectAll",
        "goDocStart",
        "goDocEnd"
    ],
    /** Enter and exit fullscreen mode when pressing F11 and exit fullscreen mode by pressing Esc */
    extraKeys: {
        "F11": function(cm) {
            cm.setOption("fullScreen", !cm.getOption("fullScreen"));
        },
        "Esc": function(cm) {
            if (cm.getOption("fullScreen")) {
                cm.setOption("fullScreen", false);
            }
        }
    }
};

/*
 * Creates a hash from the passed in string
 * @param {string} string - The string to create a hash for
 * @return {number} The hash of the given string
 */
function hashString(string){
    let hash = 0, i, chr;
    if (string.length === 0) {
        return hash;
    }
    for (i = 0; i < string.length; i++) {
        chr   = string.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

/**
 * Attempt to create a new socket connection
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function connect(event) {
    // If the socket is already set and not closed, return - we're already connected.
    if (socket != null  && socket.readyState !== WebSocket.CLOSED) {
        console.log("Socket already connected - disconnect before trying to connect to a new one");
        return;
    }

    // Get the address to connect to from the address input
    let address = $("#socket-address").val();

    // Display an error if no address was entered and exit
    if (!address) {
        updateError("No websocket address was supplied.");
        return;
    }
    else {
        // Clear all errors and warnings from the page
        updateError();
        updateWarning();
    }

    try {
        // Attempt to open a new connection
        socket = new WebSocket(address);

        // Clear everything from the receiver editor
        clearOutput();

        // Enable and disable the correct buttons based on whether the connection is valid
        setConnectionIsEnabled();

        // Clear all errors and warnings from the page
        updateError();
        updateWarning();
    } catch (error) {
        // Enable and disable the correct buttons based on whether the connection is valid
        setConnectionIsEnabled();

        // Display the error on the page
        updateError(error.message);

        // Clear all warnings to highlight the error and exit
        updateWarning();
        return;
    }

    // Make sure that the buttons are correctly enabled and disabled once the connection is opened and move to the
    //      output tab to start showing output
    socket.onopen = function() {
        setConnectionIsEnabled();
        switchToOutput(event);
    };

    // Call `receive_message` when the socket receives a message
    socket.onmessage = receive_message;

    // Call `receivedSocketError` if and when the socket encounters an error
    socket.onerror = receivedSocketError;

    //  Make sure that the buttons are correctly enabled and disabled once the connection is closed and move to the
    //      output tab for any further notifications
    socket.onclose = function() {
        setConnectionIsEnabled();
        switchToOutput(event);
    };
}

/**
 * Attempt to close a running socket connection
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function disconnect(event) {
    // If there is a socket and it's closed send a message stating the intentions of closing and close the active
    //      connection
    if (socket && socket.readyState !== WebSocket.CLOSED) {
        // Inform the socket of the intention to disconnect
        socket.send('"disconnect"');

        // Disconnect the socket
        socket.close();

        // Set the socket to null to make it clear that there is no connection
        socket = null;

        // Notify the user that the connection was closed and clear any distracting errors
        console.log("Connection to websocket closed");
        updateWarning("Connection closed. Click connect to reconnect.")
        updateError();
    }
    else {
        // Notify the user that a connection could not be closed
        updateError("There is not an open socket to disconnect from.")
        updateWarning();
    }

    // Make sure that the right buttons are enabled
    setConnectionIsEnabled();
}

/**
 * Display an error that came through the socket
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function receivedSocketError(event) {
    updateError(event.data);
    setConnectionIsEnabled();
}

/**
 * Make sure the right buttons are enabled based on the state of the socket
 */
function setConnectionIsEnabled() {
    // The JQueryUI button interface allows users to disable, not to enable, so logic needs to be based not on
    //      whether you want to see it but based on whether you don't want to see it

    // Identify if the socket has current active and open
    let alreadyConnected = socket != null && socket.readyState !== WebSocket.CLOSED;

    // Identify if the socket does not have a currently active socket
    let alreadyDisconnected = !alreadyConnected;

    // Disable the disconnect button if there's nothing to disconnect from
    $( "#disconnect-button" ).button( "option", "disabled", alreadyDisconnected );

    // Disable the connect button if the socket is already actively connected
    $( "#connect-button" ).button( "option", "disabled", alreadyConnected );

    // Disable the send-button if there isn't a socket to send data through
    $("#send-button").button("option", "disabled", alreadyDisconnected);
}

/**
 * Add a new tab if the captured event registered the "Enter" key having been pressed
 * @param {MouseEvent} event - the data provided by an event handler, like a mouse click
 */
function addPopupNameUp(event) {
    // Send the event to the addTab button if "Enter" was pressed
    if (event.key ==="Enter") {
        addTab(event);
    }
}

/**
 * Update the message in the error field
 * @param {string} message - The message to print. An empty string indicates that nothing should be shown
 */
function updateError(message) {
    // Set the message and show the message if a valid message is given
    if (message) {
        $("#error-message").text(message);
        $("#error-div").show();
    }
    else {
        // Hide the error message area if no message was passed
        $("#error-div").hide();
    }
}

/**
 * Update the message in the warning field
 * @param {string} message - The message to print. An empty string indicates that nothing should be shown
 */
function updateWarning(message) {
    // Set the message and show the message if a valid message is given
    if (message) {
        $("#warning-message").text(message);
        $("#warning-div").show();
    }
    else {
        // Hide the warning message area if no message was passed
        $("#warning-div").hide();
    }
}

/**
 * Update data from a saved tab
 * @param {CodeMirror} event - the editor that fired this event
 * @todo: Actually implement
 */
function updateTabData(event) {
    editor = event.getTextArea().getAttribute("for");


    // TODO: Actually implement this. This is on the keyup event for user added editors. This needs to store the data
    //      into saved tabs. For instance: if I'm tracking a tab named 'instructions', editing 'instructions' should
    //      also update the record for later reuse
}

/**
 * Add text to the DOM as a script element. The contained code should run after being appended.
 * @param {string} text - The text to add to the page as a script
 */
function addUserScript(text) {
    let failed = false;
    let hashedScript = hashString(text);

    // Check to see if the script has already been added. If so, go ahead and exit out. Duplicates shouldn't be added
    if (userScripts.includes(hashedScript)) {
        return;
    }

    // Create a new script element and add it to the page
    try {
        let newScript = document.createElement("script");
        newScript.type = "text/javascript";
        newScript.innerHTML = text;
        $("#user-scripts").append(newScript);
    } catch (exception) {
        console.error(exception);
        updateError(exception);
    }

    // Add the hash of the script to the list so we don't accidentily create a duplicate
    userScripts.push(hashedScript);
}

/**
 * Send the data in the sender editor through the socket
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function send_message(event) {
    // Exit early if there isn't a socket available to send data through
    if (socket ===null || socket.readyState ===WebSocket.CLOSED) {
        updateError("Data cannot be sent through a socket - there is no active connection. Connect and try again.");
        return;
    }

    let enteredData = null;

    // Attempt to parse data out from the sender
    try {
        enteredData = JSON.parse(getSenderValue());
    }
    catch (error) {
        // Prompt the user if they still want to send the data even if it can't be parsed
        launchSendRawData(event, error);
        return;
    }

    // Exit out if no useful data was deserialized
    if (!enteredData) {
        updateError("Data could not be deserialized - nothing was sent to the server");
        return;
    }

    try {
        // Package the data up in a clean, easy to read form
        const enteredJSON = JSON.stringify(enteredData, null, 4);

        // Throw an error if the data could not be serialized to be sent (highly unlikely at this point)
        if (!enteredJSON) {
            updateError("Data could not be serialized - nothing was sent to the server");
            return;
        }

        // Send the data through the socket and switch to the output tab to see any sort of response
        socket.send(enteredJSON);
        switchToOutput(event);
    }
    catch (error) {
        // Report any possible error that arose while trying to send data
        updateError(error);
    }
}

/**
 * Switch to the output tab
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function switchToOutput(event) {
    // Simulate a click on the tab - this will activate the tab widgets flip
    $("#output-tab-link").click();

    // Refresh the receiver - this will encourge data to be rendered if it hasn't already
    setTimeout(function() {
        receiver.refresh();
    },1);
}

/**
 * Show a popup asking the user if they want to send data through the socket even if it isn't valid JSON
 * @param {Event} event - the data provided by an event handler, like a mouse click
 * @param {string} message - a message describing why the data couldn't be sent normally
 */
function launchSendRawData(event, message) {
    // Hide any other popups
    hidePopups(event);

    // Show the modal
    $("#modal").css("display", "block");

    // Show the popup
    $("#raw-data-popup").show();

    // Add the message to the popup
    $("#raw-data-error").text(message);
}

/**
 * Hide all popups
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function hidePopups(event) {
    $("#modal").hide();
    $("#modal .popup").hide()
}

/**
 * Get the fully qualified value from the sender editor
 * @return {string} The data from the sender editor with all template variables replaced with their actual value
 */
function getSenderValue() {
    // Grab the raw string that was in the editor
    let senderText = sender.getValue();

    // Create a list that will contain all keys of values that were subbed into the senderText
    let usedValues = [];

    // Iterate through every extra editor and try to find keys that need to be replaced
    for (let key in extraTabEditors) {
        // Create a replacement regex - this will replace things like `%%instructions%%` if an `instructions` editor
        //      is found
        let replacer = `\%\%${key}\%\%`

        // Replace text if it's found
        if (senderText.match(replacer)){
            senderText = senderText.replaceAll(replacer, extraTabEditors[key].getValue());
        }

        // Add the key to the list so we can keep track that this was replacd
        usedValues.push(key);
    }

    // Now iterate through every item in session storage to find other stuff to replace
    for (let key in STORAGE) {
        // Move on if this key isn't data from another editor
        if (!key.startsWith(EXTRA_STORAGE_KEY)) {
            continue;
        }

        // Get the actual key for the stored value
        let identifier = key.replace(EXTRA_STORAGE_KEY, "");

        // Continue to the next key if we've already subbed in this data
        if (identifier in usedValues) {
            continue;
        }

        // Create a regex like above which will look for the key surrounded by `%%`
        let replacer = `\%\%${identifier}\%\%`;

        // If there is a match, fetch the data from storage and sub it into the sender text
        if (senderText.match(replacer)) {
            let replacementData = STORAGE.getItem(key);
            senderText = senderText.replaceAll(replacer, replacementData);
        }
    }

    return senderText;
}

/**
 * Create a new tab with a new editor
 * @param {string} tabID - The ID of the new new tab element
 * @param {string} name - The user facing name of this new tab
 * @param {string} text - any text to add to the new editor
 */
function buildTab(tabID, name, text) {
    // Find the template used for new tabs
    let tabTemplate = document.querySelector('#tab-template');

    // Copy the tab to create a new element
    let newTab = document.importNode(tabTemplate.content, true);

    // Set the new ID on the primary editor div
    newTab = newTab.querySelector("div.editor-tab");
    newTab.id = tabID;

    // Set the id on the textarea that will be used to store the editor data
    newTab.querySelector(".tab-editor textarea").id = `${tabID}-editor`;

    // Inform the editor of what tab it will be editing on
    newTab.querySelector(".tab-editor textarea").setAttribute("for", tabID);

    // Inform the new fullscreen button of which editor it is supposed to make fullscreen
    newTab.querySelector(".fullscreen-button").setAttribute("editor", tabID);

    // Inform the new save button of what editor's data it is supposed to save
    newTab.querySelector(".save-button").setAttribute("editor", tabID);

    // Inform the new commit button of what editor's data it needs to be able to commit
    newTab.querySelector(".commit-button").setAttribute("editor", tabID);

    // Attach an event handler that will run the `launchCommit` function if the commit button is clicked
    newTab.querySelector(".commit-button").addEventListener("click", launchCommit);

    // Attach an event handler that will call `saveCode` if the new save button is clicked
    newTab.querySelector(".save-button").addEventListener('click', saveCode);

    // Add the newly create tab to the previously created tabs element. This will hold the content that will
    //      show up when the tab is clicked
    tabs.append(newTab);

    // Create the list item that will show up as the new tab
    let tabEntry = document.createElement("li");

    // Create the anchor that will show the name and whose click will open the newly added tab
    let tabLink = document.createElement("a");
    tabLink.href = `#${tabID}`;
    tabLink.textContent = name;

    // Add the new link to the new tab entry
    tabEntry.append(tabLink);

    // Add the new tab item to the listing of tabs in order to show it in the listing
    tabs.find(".ui-tabs-nav").append(tabEntry);

    // Refresh that tabs so that the new tab and tab content are correctly styled and set up for hiding and showing
    tabs.tabs("refresh");

    // Make sure all 'tester-button' and 'editor-button' objects are properly configured to be buttons
    $(".tester-button").button();
    $(".editor-button").button();

    // Create a new editor within the new tab and add it to the mapping of ids to editors
    extraTabEditors[tabID] = CodeMirror.fromTextArea(
        $(`#${tabID}-editor`)[0],
        senderConfig
    );

    // Attach a handler that will update saved tab data when it is modified
    extraTabEditors[tabID].on("keyup", updateTabData);

    // If text is passed, insert it as new content
    if (text) {
        extraTabEditors[tabID].setValue(text);
    }
    else {
        // Check to see if matching data is present
        let tabKey = EXTRA_STORAGE_KEY + tabID;
        let previousData = STORAGE.getItem(tabKey);

        // Insert matching data into the editor if it was found
        if (previousData) {
            extraTabEditors[tabID].setValue(previousData);
        }
    }

    // Click the tab so that it is immediately shown
    tabLink.click();
}

/**
 * Send a message that may not be deserializable through the socket
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function send_raw_message(event) {
    try {
        let data = getSenderValue();

        if (data) {
            // Attempt to send the data from the editor through the socket
            socket.send(data);

            // Switch to the output tab if everything worked out in order to see the response
            switchToOutput(event);
        }
    }
    catch (error) {
        // Show the error on the screen if everything didn't workout
        updateError(error);
    }

    // Hide the popups since this command most likely came from a popup
    hidePopups(event);
}

/**
 * Generate a randomized ID
 * @return {string}
 */
function generateID() {
    return Math.floor(Math.random() * 1000).toString();
}

/**
 * Replace values that might be obfuscated when stringified with tags
 * @param {{string: *}|*} message An object or value that may contain values that will be obfuscated when stringified
 * @param {{string: *}?} markers An optional map of predefined markers
 * @return {{"message": {string: *}|*, "markers": {string: string}}} An object containing the transformed message and
 *  a mapping from all contained tags to their values
 */
function markForReplacement(message, markers) {
    if (markers == null) {
        markers = {};
    }

    if (typeof message !== 'object') {
        return {
            "message": message,
            "markers": markers
        }
    }

    for (let [key, value] of Object.entries(message)){
        if (typeof value === 'string') {
            let newID = generateID();

            while(Object.keys(markers).includes(newID)){
                newID = generateID();
            }

            let marker = `{%${newID}%}`;

            markers[marker] = value;
            message[key] = marker;
        }
        else if (typeof value === "object") {
            const markResults = markForReplacement(value, markers);
            markers = markResults['markers'];
            message[key] = markResults['message'];
        }
    }

    return {
        "message": message,
        "markers": markers
    }
}

/**
 * Replace template markers in message with their proper values
 * @param {string} message A message that might contain IDs that map to other values
 * @param {{string: *}} markers A mapping of replacement tags to replacement values
 * @return {string} A new string with all template tags replaced with their values
 */
function replaceMarkers(message, markers) {
    for (let [ID, content] of Object.entries(markers)) {
        message = message.replaceAll(ID, content);
    }

    return message;
}

/**
 * Load all saved messages
 * @return {{"timestamp": Date, "message": string, "key": string}[]} A list of all saved messages
 */
function readSavedMessages() {
    let savedMessages = [];

    for (let index = 0; index < sessionStorage.length; index++) {
        let key = STORAGE.key(index);

        if (key.startsWith(SAVED_MESSAGE_PREFIX)) {
            let timestamp = new Date(key.replace(SAVED_MESSAGE_PREFIX, ""));
            let message = STORAGE.getItem(key);
            savedMessages.push({"timestamp": timestamp, "message": message, "key": key});
        }
    }

    savedMessages = savedMessages.sort(
        function(message1, message2){
            return message1.timestamp - message2.timestamp;
        }
    );

    return savedMessages;
}

/**
 * A message to store in the tester
 * @param {(string|Date)?} date When the message came in
 * @param {string} message The message to store
 */
function storeMessage(date, message) {
    try {
        if (date === null || date instanceof undefined) {
            date = new Date().toLocaleString();
        } else if (date instanceof Date) {
            date = date.toLocaleString();
        }

        const key = SAVED_MESSAGE_PREFIX + date;

        let currentMessages = readSavedMessages();

        while (currentMessages.length > MAXIMUM_SAVED_MESSAGES) {
            let oldMessage = currentMessages.shift();
            sessionStorage.removeItem(oldMessage.key);
        }

        STORAGE.setItem(key, message);
    } catch (e) {
        console.error(e);
    }
}

/**
 * Format a message so that it may be displayed within the output view
 * @param {string|Date} timestamp
 * @param {string} message
 */
function formatMessage(timestamp, message) {
    if (timestamp instanceof Date) {
        timestamp = timestamp.toLocaleString();
    }
    const barrier = `//${Array(200).join("=")}`;
    const timestampLine = `// [${timestamp}]:`
    let formattedMessage = `${barrier}\n${timestampLine}\n\n${message}`;
    return `\n${formattedMessage}\n\n`;
}

/**
 * Load the receiver code view with stored messages
 */
function loadMessages() {
    try {
        const formattedMessages = readSavedMessages().map(
            (message) => formatMessage(message.timestamp, message.message)
        );

        const newMessage = "".concat(...formattedMessages);

        addMessageToReceiver(newMessage);
    }
    catch (e) {
        console.error(e);
    }
}

/**
 * Function to call when a message comes through the websocket
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function receive_message(event) {
    let formattedData = "";

    // Try to deserialize and reformat the received data
    try {
        // The received text is most likely a string with little to no newlines. Parse and stringify it to
        //      make sure everything is readable.
        let data = JSON.parse(event.data);
        let replacementData = markForReplacement(data);
        formattedData = JSON.stringify(data, null, 4);
        let formattedForReplacement = JSON.stringify(replacementData['message'], null, 4);
        formattedData = replaceMarkers(formattedForReplacement, replacementData['markers'])
    } catch (exception) {
        // Accept incoming data as a straight string rather than JSON if the deserialization didn't work out
        formattedData = event.data;
    }

    // Get and attach the current date and time to the incoming data to make durations more obvious
    let currentDate = new Date().toLocaleString();

    let newMessage = formatMessage(currentDate, formattedData);

    storeMessage(currentDate, formattedData);

    addMessageToReceiver(newMessage);
}

function addMessageToReceiver(message) {
    // Place the curser at the end of the receiver
    receiver.execCommand("goDocEnd");

    // Insert the new text at the end of the editor
    receiver.replaceRange(message, receiver.getCursor());

    // Make sure the data at the end is visible
    receiver.scrollIntoView(receiver.lastLine());

    // TODO: Check if there's a way to not scroll if there is focus on the editor or if it's currently being looked
    //      at - you don't want the editor to scroll to the bottom every two seconds if you're examining previous
    //      messages
}

/**
 * Show the tab for adding new tabs
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function launchAddTab(event) {
    // Make sure that the modal and any previous popups are hidden so that they don't overlap the new one
    hidePopups();

    // Load up a list of any stored tab information for data reuse - provide the name/tab 'instructions' if I
    //      created a tab named 'instructions' on a previous visit
    loadPreviousTabs();

    // Show the modal
    $("#modal").css("display", "block");

    // Set the input to a blank string so that an old value isn't there
    $("#add-popup-name").val("");

    // Show the popup
    $("#add-tab-popup").show();

    // Ensure that the editor is immediately focused so that the user may be able to immediately start typing
    $("#add-popup-name").focus();
}

/**
 * Launch the popup that will allow the user to commit their work from a user created editor
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function launchCommit(event) {
    // Make sure that the modal and any previous popups are hidden so that they don't overlap the new one
    hidePopups();

    // Show the name of the current editor on the popup
    let editorName = this.getAttribute("editor");
    $("#editorName").val(editorName);

    // Display the popup
    $("#commit-popup").show();
}

/**
 * Add the text in an editor to the DOM as a new script
 * @todo: Implement
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function commitCode(event) {
    debugger;
    // This should create a new script tag, add the text from the editor to it, and attach it to the DOM
}

/**
 * Add the text to a text variable in the code space
 * @todo: Implement
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function commitText(event) {
    debugger;
    // This should ideally just do something like set the variable `instructions` to the string in the
    //      `instructions` editor
}

/**
 * Add a new tab to the page
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function addTab(event) {
    // Start by making sure all popups are not on the page since this call probably came from one
    hidePopups();

    // Get the name and form an ID for it. The difference between the two is that the ID should be able to be a
    //      valid variable name
    let name = $("#add-popup-name").val();
    let tabID = name.replaceAll(INVALID_VARIABLE_CHARACTERS, "_");

    // Inform the user that the tab can't be added if there's already one with this name and exit
    if (tabID in extraTabEditors) {
        updateError(`There is already a tab named ${name}`);
        return;
    }

    // Add the elements to the screen
    buildTab(tabID, name);

    // En sure that all editors fit within their tabs
    resizeEditors(event);
}

/**
 * Ensures that every editor fits within their tab
 */
function resizeEditors(event) {
    // Run the resizing logic on all tabs by first finding all containers for editors
    for (let tabWithEditor of $(".tab-editor")){

        // The outermost DOM element of the editor itself
        let innerEditor = null;

        // The height of all elements that AREN'T the editor
        let nonEditorHeight = 0;

        // Iterate through all of the children of this container to a) find the editor and b) find the combined
        //      height of all elements that aren't the editor
        for (let innerElement of tabWithEditor.children) {
            if (innerElement.classList.contains("CodeMirror")) {
                innerEditor = innerElement;
            }
            else {
                nonEditorHeight += innerElement.offsetHeight;
            }
        }

        // If an editor was found, set its height so that it fits snugly within the tab alongside all of the other
        //      elements
        if (innerEditor) {
            $(innerEditor).css("height", `${tabWithEditor.offsetHeight - 10 - nonEditorHeight}px`);

            // Call focus on the editor to attempt to refresh its contents; there's probably a better way to do this
            //      by calling its CodeMirror object directly
            $(innerEditor).focus();
        }
    }
}

/**
 * Delete a user created tab
 * @todo: Implement
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function deleteTab(event) {
    debugger;
    // This should remove the tab and all record of its contents (such as the editor). Any committed text from the
    //      tab's editor should still be available
}

/**
 * Update the saved value in session storage for the socket address given by the user
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function addressKeyUp(event) {
    STORAGE.setItem(STORED_ADDRESS_KEY, $("#socket-address").val());
}

/**
 * Clear all text from the output editor
 */
function clearOutput() {
    receiver.setValue("");
}

/**
 * Update the saved text from the primary editor in session storage
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function updateInput(event) {
    let inputData = sender.getValue();
    STORAGE.setItem(STORED_INPUT_KEY, inputData);
}

/**
 * Get a listing of all valid tabs
 * A tab is considered valid if its name is within the SAVED_TAB_KEY and there is a record for its value in session storage
 * @return {Array<string>} The names of all reusable tabs
 */
function getSavedTabs() {
    let savedTabNames = STORAGE.getItem(SAVED_TAB_KEY);

    if (savedTabNames ===null) {
        STORAGE.setItem(SAVED_TAB_KEY, []);
        savedTabNames = [];
    }
    else {
        savedTabNames = savedTabNames.split(",");
    }

    let validTabNames = [];
    savedTabNames.forEach(function(savedTabName) {
        let contentKey = EXTRA_STORAGE_KEY + savedTabName;

        if (contentKey in STORAGE) {
            validTabNames.push(savedTabName);
        }
    });
    STORAGE.setItem(SAVED_TAB_KEY, validTabNames);

    return validTabNames;
}

/**
 * Saves the name of a tab and all other valid tabs to the listing in session storage
 * @param {string} tabName - The name of the tab to add
 */
function addTabRecord(tabName) {
    //  Get all currently saved names - this will either be a string or null since session storage doesn't store arrays
    let savedTabNames = STORAGE.getItem(SAVED_TAB_KEY);

    // Add and keep an empty list if no list was found
    if (savedTabNames ===null) {
        STORAGE.setItem(SAVED_TAB_KEY, []);
        savedTabNames = [];
    }
    else {
        // Break apart the found values by ',', which is the character session storage uses to combine session
        //      storage values with when they are arrays
        savedTabNames = savedTabNames.split(",");
    }

    // Go ahead and complete operations if the tab to add is already in the list
    if (savedTabNames.includes(tabName)) {
        return;
    }

    // Create a collection of valid tab names - this list will replace the old list in order to flush any invalid tabs
    // We start with the tab we seek to add since its valid by virtue of getting here
    let validTabNames = [tabName];

    // Iterate through every one of the found tab names and check to see if there is accompanying data
    for (let savedTabName of savedTabNames) {
        // The key for the data isn't the saved tab name; combine it with the prefix to find the real key
        let contentKey = EXTRA_STORAGE_KEY + savedTabName;

        // The tab/key is considered valid if there is an entry in session storage for the combined key
        // Store the actual name (not the combined name) if it is found
        if (contentKey in STORAGE) {
            validTabNames.push(savedTabName);
        }
    }

    // Update the list of saved tab names with the new list of valid tabs
    STORAGE.setItem(SAVED_TAB_KEY, validTabNames);
}

/**
 * Save the code in an editor to session storage
 * @param {Event} event - the data provided by an event handler, like a mouse click
 */
function saveCode(event) {
    // This should be triggered by a button click and said button should have an attribute named 'editor',
    //      which will be the name of the editor whose data we need to save
    let editorName = this.getAttribute("editor");

    // Now that we have the name, get the actual CodeMirror object that accompanies it
    let editor = getEditor(editorName);

    // Find the key for this editor
    let saveKey = null;

    // We have a special key for the sender, so choose that one if the found editor is actually the sender
    if (editor === sender) {
        saveKey = STORED_INPUT_KEY;
    }
    else {
        // ...otherwise the name is the prefix + the editor name
        saveKey = EXTRA_STORAGE_KEY + editorName;
    }

    // Save the value of the editor to session storage
    STORAGE.setItem(saveKey, editor.getValue());

    // Make sure that there's a record for the tab whose data was added
    addTabRecord(editorName);
}

/**
 * Find the CodeMirror instance based off of its name
 */
function getEditor(name) {
    // Get the sender or receiver instances if asked specifically, otherwise pull editor from the name => editor mapping
    if (name === "sender") {
        return sender;
    }
    else if (name ==="receiver") {
        return receiver;
    }
    else if (name in extraTabEditors) {
        return extraTabEditors[name];
    }

    // Throw an error since what was asked for was nonsense - there is no editor by this name
    throw `There is no editor named '${name}'`;
}

/**
 * Expand the editor into fullscreen mode
 * @param {Event} clickEvent - the mouse click the caused this to be called
 */
function launchFullscreen(clickEvent){
    // This should be triggered by a button click and said button should have an attribute named 'editor',
    //      which will be the name of the editor whose data we need to save
    let editorName = this.getAttribute("editor");

    // Now that we have the name, get the actual CodeMirror object that accompanies it
    let editor = getEditor(editorName);

    // Set the fullscreen option on the editor - this will make sure that it expands to fit the fullscreen
    editor.setOption("fullScreen", true);
}

/**
 * Creates a list of options to use in the add tab popup for new tabs
 */
function loadPreviousTabs() {
    // Get the listing of all current tabs that have values
    let previousNames = getSavedTabs();

    // Iterate through every tab and insert an option for it into the #previous-tabs datalist element
    let dataList = document.getElementById("previous-tabs");
    for (let name of previousNames) {
        let option = document.createElement("option");
        option.value = name;
        dataList.appendChild(option);
    }
}

// Runs when the page is done loading
$(function(){
    // Turn everything with the classes 'tester-button', 'editor-button', and 'close-popup-button' into a pretty,
    //      clickable button
    $(".tester-button").button();
    $(".editor-button").button();
    $(".close-popup-button").button();

    // Make it so everything with the class 'fullscreen-button' can expand the accompanying editor to cover the
    //      entire screen
    $(".fullscreen-button").on("click", launchFullscreen);

    // Disable the send button since there's no connection to send things through (yet)
    $("#send-button").button({
        disabled: true
    });

    // Disable the disconnect button since there's nothing to disconnect from (yet)
    $("#disconnect-button").button({
        disabled: true
    });

    // Create the primary editor that will house the data to send to the server
    sender = CodeMirror.fromTextArea(
        $("#outgoing-message-text")[0],
        senderConfig
    );

    // Add an event handler to the sender so that its text is saved to session storage whenever it changes
    sender.on("change", updateInput);

    // Create the read-only editor that will show all incoming message data
    receiver = CodeMirror.fromTextArea(
        $("#incoming-message-text")[0],
        receiverConfig
    );

    // Add an event handler to the click event for the connect button that will attempt to create a new websocket
    //      connection
    $("#connect-button").on("click", function(event){
        event.preventDefault();
        connect(event);
    });

    // Add an event handler to the click event for the disconnect button that will attempt to stop communication
    //      through the websocket
    $("#disconnect-button").on("click", function(event){
        event.preventDefault();
        disconnect(event);
    });

    // Add an event handler that will save the address used to connect to the websocket whenever the address changes
    $("#socket-address").on("change", addressKeyUp);

    // Add an event handler to the click event on the send button to send messages through the websocket
    $("#send-button").on("click", function(event){
        event.preventDefault();
        send_message(event);
    });

    // Add a handler to the click event on every close button on the popups that will hide all of the popups
    $(".close-popup-button").on("click", function(event){
        event.preventDefault();
        hidePopups(event);
    });

    // Add a handler to the click event to the button on the popup for saving raw data that will instruct the
    //      system to send the raw data, not JSON, through the websocket
    $("#send-raw-button").on("click", function(event){
        event.preventDefault();
        send_raw_message(event);
    });

    // Add a handler to the click event to the button used to add new tabs that will launch to popup for
    //      adding a new tab
    $("#open-tab-popup-button").on("click", function(event){
        event.preventDefault();
        launchAddTab(event);
    });

    // Add a handler to the click event to the button on the add tab popup that will add a new tab to the screen
    $("#add-tab-button").on("click", function(event){
        event.preventDefault();
        addTab(event);
    });

    // Try to find a stored address. If found, insert it into the address field. This way the last address may be used
    let storedAddress = STORAGE.getItem(STORED_ADDRESS_KEY);

    if (storedAddress) {
        $("#socket-address").val(storedAddress);
    }

    // Try to find the last data written into the primary editor. If found, add it to the primary editor so
    //      that work may be continued. The user can just delete the text if they don't want it.
    let storedInput = STORAGE.getItem(STORED_INPUT_KEY);

    if (storedInput) {
        sender.setValue(storedInput);
    }

    // Create the tabs on the UI - this will make sure they are positioned, correctly styled,
    //      and have all important event handlers added
    tabs = $("#editor-tabs").tabs();

    // Add an event handler to the 'tabsactivate' handler that will fire anytime one of the tabs is clicked and the
    //      tab changes. The handler will ensure that the editor on the tab correctly fits its space
    $("#editor-tabs").on("tabsactivate", resizeEditors);

    // Ensure that every tab fits within its designated space.
    resizeEditors();

    loadMessages();
});