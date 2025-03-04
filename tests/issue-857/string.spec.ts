import { Component, NgModule } from '@angular/core';

import { MockBuilder, MockRender, ngMocks } from 'ng-mocks';

@Component({
  selector: 'target',
  template: 'target',
})
class Target857Component {}

@NgModule({
  declarations: [Target857Component],
  exports: [Target857Component],
})
class TargetModule {}

ngMocks.globalExclude('@Target857Component' as never);

// @see https://github.com/ike18t/ng-mocks/issues/857
describe('issue-857:string', () => {
  ngMocks.throwOnConsole('error');
  beforeEach(() => MockBuilder(null, TargetModule));

  it('excludes by string', () => {
    expect(() => MockRender(Target857Component)).toThrowError(
      /'target' is not a known element/,
    );
  });
});
