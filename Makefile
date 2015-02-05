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
	  browserify -x knockout -p bundle-collapser/plugin -e lib -s knockoutTransformations) > $@

dist/knockout-transformations.min.js: dist/knockout-transformations.js
	@(echo '/*!' &&\
	  cat LICENSE &&\
	  echo '\n*/' &&\
	  uglifyjs dist/knockout-transformations.js) > $@

.PHONY: git-dirty-check
git-dirty-check:
ifneq ($(shell git describe --always --dirty | grep -- -dirty),)
	$(error Working tree is dirty, please commit or stash your changes, then try again)
endif

.PHONY: release-%
release-%: git-dirty-check lint test dist/knockout-transformations.min.js
	npm version $*
	@echo $* release ready to be publised to NPM
	@echo Remember to push tags
