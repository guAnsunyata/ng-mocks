import { Directive } from '@angular/core';
import { NG_VALIDATORS, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MockDirective } from 'ng-mocks';
import coreReflectDirectiveResolve from 'ng-mocks/dist/lib/common/core.reflect.directive-resolve';

@Directive({
  selector: 'directive',
})
export class DirectiveDefault {}

@Directive({
  providers: [
    {
      multi: true,
      provide: NG_VALUE_ACCESSOR,
      useExisting: DirectiveValueAccessor,
    },
  ],
  selector: 'directive',
})
export class DirectiveValueAccessor {}

@Directive({
  providers: [
    {
      multi: true,
      provide: NG_VALIDATORS,
      useExisting: DirectiveValidator,
    },
  ],
  selector: 'directive',
})
export class DirectiveValidator {}

// providers should be added to directives only in case if they were specified in the original directive.
describe('issue-145:directives', () => {
  it('does not add NG_VALUE_ACCESSOR to directives', () => {
    const mock = MockDirective(DirectiveDefault);
    const { providers } = coreReflectDirectiveResolve(mock);
    expect(providers).toEqual([
      {
        provide: DirectiveDefault,
        useExisting: jasmine.anything(),
      },
    ]);
  });

  it('adds NG_VALUE_ACCESSOR to directives that provide it', () => {
    const mock = MockDirective(DirectiveValueAccessor);
    const { providers } = coreReflectDirectiveResolve(mock);
    expect(providers).toEqual([
      {
        provide: DirectiveValueAccessor,
        useExisting: jasmine.anything(),
      },
      {
        multi: true,
        provide: NG_VALUE_ACCESSOR,
        useFactory: jasmine.anything(),
      },
    ]);
  });

  it('respects NG_VALIDATORS too', () => {
    const mock = MockDirective(DirectiveValidator);
    const { providers } = coreReflectDirectiveResolve(mock);
    expect(providers).toEqual([
      {
        provide: DirectiveValidator,
        useExisting: jasmine.anything(),
      },
      {
        multi: true,
        provide: NG_VALIDATORS,
        useFactory: jasmine.anything(),
      },
    ]);
  });
});
