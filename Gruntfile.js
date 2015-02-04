module.exports = function(grunt) {
    var pkg = grunt.file.readJSON('package.json');
    grunt.initConfig({
        pkg: pkg,
        jshint: {
            all: [
                'lib/**/*.js',
                'test/**/*.js'
            ],
            options: {
                jshintrc: true
            }
        },
        jscs: {
            src: ["lib/*.js", "test/*.js"],
            options: {
                config: ".jscsrc",
            }
        },
        concat: {
            options: {
                process: function(src) {
                    return src.replace('@@version@@', pkg.version);
                }
            },
            dist: {
                src: ['lib/knockout-transformations.js'],
                dest: 'dist/<%= pkg.name %>.js'
            }
        },
        uglify: {
            options: {
                preserveComments: 'some'
            },
            build: {
                src: 'dist/<%= pkg.name %>.js',
                dest: 'dist/<%= pkg.name %>.min.js'
            }
        },
        'string-replace': {
            dist: {
                files: {
                    'package.nuspec': 'package.nuspec'
                },
                options: {
                    replacements: [{ pattern: /<version>.*?<\/version>/, replacement: '<version><%= pkg.version %></version>' }]
                }
            }
        },
        mochaTest: {
            test: {
                options: {
                    reporter: 'spec',
                },
                src: ['test/**/*.spec.js']
            },
        },
        watch: {
            scripts: {
                files: ['lib/*.js', 'spec/*.js'],
                tasks: ['default'],
                options: { nospawn: false }
            },
        }
    });

    grunt.loadNpmTasks('grunt-jscs');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-string-replace');

    grunt.registerTask('test', ['mochaTest']);
    grunt.registerTask('build', ['concat', 'string-replace', 'uglify']);
    grunt.registerTask('default', ['jshint', 'test', 'build']);
};
