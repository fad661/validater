const gulp = require('gulp');
const typescript = require('gulp-typescript');
const sourcemaps = require('gulp-sourcemaps');

const path = {
  typescript: {
    src: 'assets/ts/*.ts',
    dest: 'static/js'
  }
};

gulp.task('typescript', function () {
  return gulp.src(path.typescript.src)
    .pipe(sourcemaps.init())
    .pipe(typescript(
      {
        target: 'ES5',
        module: 'commonjs'
      }
    ))
    .js
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(path.typescript.dest));
})

gulp.task('watch', function () {
  gulp.watch(path.typescript.src, gulp.task('typescript'));
});

gulp.task(
  'default',
  gulp.series(
    gulp.parallel(
      'typescript',
    )
  )
);