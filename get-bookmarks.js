
const { selectDom } = require('./select-tree.js')

function chromeDtToDate(st_dt) {
	let microseconds = parseInt(st_dt, 10);
	let millis = microseconds / 1000;
	let past = new Date(1601, 0, 1).getTime();
	return new Date(past + millis);
}

// I guess I owe this an explaination, this is basically a list of queries to run,
//   but making it recursive makes it look more advanced, anything surrounded by 
//   [] generates a list of results
//   anything surrounded by {} generates an object of results where the values 
//   are the query and the keys are the object property names

const BOOKMARKS_TREE = [
	'*/*/dl/dt[./h3]', // select all the headings
	function parseBookmarks(ctx) {
		return selectDom({
			folder: './h3/text()', // get heading text
			links: [ // all the links under that heading
				'./dl/dt/a',
				{
					url: './@href',
					time: './@add_date',
					title: './text()'
				},
				(obj) => ({ // a bit of parsing
					url: obj.url + '',
					title: obj.title + '',
					time_usec: parseInt(obj.time + ''),
					date: chromeDtToDate(parseInt(obj.time + '')).getTime()
				})
			],
			// get children from same context as each heading
			children: (ctx) => selectDom(['./dl/dt[./h3]', parseBookmarks], ctx)
		}, ctx)
	}
]

module.exports = {
	BOOKMARKS_TREE
}

