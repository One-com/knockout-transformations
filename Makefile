PATH := ${PATH}:./node_modules/.bin

build: lint test dist/knockout-transformations.min.js

.PHONY: lint
lint:
	@jshint lib/*.js test/*.js
	@jscs lib/*.js test/*.js

.PHONY: test
test:
	@mocha

dist/knockout-transformations.js: lib/*
	@(echo '/*!' &&\
	  cat LICENSE &&\
	  echo '\n*/' &&\
	  browserify -p bundle-collapser/plugin -e lib) > $@

dist/knockout-transformations.min.js: dist/knockout-transformations.js
	@(echo '/*!' &&\
	  cat LICENSE &&\
	  echo '\n*/' &&\
	  uglifyjs dist/knockout-transformations.js) > $@
