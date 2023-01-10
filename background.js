chrome.runtime.onInstalled.addListener(() => {
	// Disable Page actions by default and enable on Salesforce tabs
	chrome.action.disable();

	// Clear all rules to ensure only our expected rules are set
	chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {

		// Declare a rule to enable the action on Salesforce pages
		// Matches examples :
		// na4.salesforce.com
		// cs13.salesforce.com
		// company.my.salesforce.com
		// emea.salesforce.com
		let isValidUrlRule = {
			conditions: [
				new chrome.declarativeContent.PageStateMatcher({
					pageUrl: {urlMatches: '(ap|eu|na|cs|emea|.*\.my)[0-9]*\.(visual\.force\.com|salesforce\.com)'}
				}),
				new chrome.declarativeContent.PageStateMatcher({
					pageUrl: {urlMatches: '(.*).(lightning\.force\.com)'}
				})
			],
			actions: [new chrome.declarativeContent.ShowAction()],
		};

		// Finally, apply our new array of rules
		let rules = [isValidUrlRule];
		chrome.declarativeContent.onPageChanged.addRules(rules);
	});
});