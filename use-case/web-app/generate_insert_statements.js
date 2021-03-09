/*
const loremIpsum = require("lorem-ipsum")

const numberOfCompanies = 30

const sqls = Array.from(Array(numberOfCompanies).keys())
	.map(companyId => {
		const heading = loremIpsum.loremIpsum({ count: 1, units: "sentence" }).replace(/[\r\n]+/g, "");
		const description = loremIpsum.loremIpsum({ count: 5, units: "paragraphs" }).replace(/[\r\n]+/g, "\\n");

		return `INSERT INTO companies (name, origin, segment, logo_link) VALUES ('sts-${missionId}', '${description}', '${heading}');`
	
	})
	.join("\n")

console.log(sqls)
*/