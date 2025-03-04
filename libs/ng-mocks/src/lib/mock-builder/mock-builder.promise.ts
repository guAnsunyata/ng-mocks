import { Provider } from '@angular/core';
import { TestBed, TestModuleMetadata } from '@angular/core/testing';

import { flatten, mapValues } from '../common/core.helpers';
import { Type } from '../common/core.types';
import funcGetName from '../common/func.get-name';
import { isNgDef } from '../common/func.is-ng-def';
import { isNgModuleDefWithProviders } from '../common/func.is-ng-module-def-with-providers';
import ngMocksUniverse from '../common/ng-mocks-universe';

import { MockBuilderStash } from './mock-builder-stash';
import addMissingKeepDeclarationsAndModules from './promise/add-missing-keep-declarations-and-modules';
import addMissingMockDeclarationsAndModules from './promise/add-missing-mock-declarations-and-modules';
import addRequestedProviders from './promise/add-requested-providers';
import applyPlatformModules from './promise/apply-platform-modules';
import createNgMocksOverridesToken from './promise/create-ng-mocks-overrides-token';
import createNgMocksToken from './promise/create-ng-mocks-token';
import createNgMocksTouchesToken from './promise/create-ng-mocks-touches-token';
import detectWrongDeclarations from './promise/detect-wrong-declarations';
import handleEntryComponents from './promise/handle-entry-components';
import handleRootProviders from './promise/handle-root-providers';
import initNgModules from './promise/init-ng-modules';
import initUniverse from './promise/init-universe';
import parseMockArguments from './promise/parse-mock-arguments';
import parseProvider from './promise/parse-provider';
import { BuilderData } from './promise/types';
import { IMockBuilder, IMockBuilderConfig, IMockBuilderResult } from './types';

const normaliseModule = (
  module: any,
): {
  def: Type<any>;
  providers?: Provider[];
} =>
  isNgModuleDefWithProviders(module)
    ? { def: module.ngModule, providers: module.providers }
    : { def: module, providers: undefined };

const generateProviderValue = (provider: any, existing: any, multi: boolean): any =>
  multi ? [...(Array.isArray(existing) ? existing : /* istanbul ignore next */ []), provider] : provider;

const defaultMock = {}; // simulating Symbol

export interface MockBuilderPromise {
  [Symbol.toStringTag]: 'Promise';
}

export class MockBuilderPromise implements IMockBuilder {
  protected beforeCC: Set<(testBed: typeof TestBed) => void> = new Set();
  protected configDef: BuilderData['configDef'] = new Map();
  protected defProviders: BuilderData['defProviders'] = new Map();
  protected defValue: BuilderData['defValue'] = new Map();
  protected excludeDef: BuilderData['excludeDef'] = new Set();
  protected keepDef: BuilderData['keepDef'] = new Set();
  protected mockDef: BuilderData['mockDef'] = new Set();
  protected providerDef: BuilderData['providerDef'] = new Map();
  protected replaceDef: BuilderData['replaceDef'] = new Set();
  protected stash: MockBuilderStash = new MockBuilderStash();

  public constructor() {
    // istanbul ignore else
    if (typeof Symbol !== 'undefined') {
      (this as any)[Symbol.toStringTag] = 'Promise';
    }
  }

  public beforeCompileComponents(callback: (testBed: typeof TestBed) => void): this {
    this.beforeCC.add(callback);

    return this;
  }

  public build(): TestModuleMetadata {
    this.stash.backup();
    ngMocksUniverse.config.set('mockNgDefResolver', new Map());
    ngMocksUniverse.flags.add('hasRootModule');

    try {
      const params = this.combineParams();

      const ngModule = initNgModules(params, initUniverse(params));
      detectWrongDeclarations(params);
      addMissingKeepDeclarationsAndModules(ngModule, params);
      addMissingMockDeclarationsAndModules(ngModule, params);
      addRequestedProviders(ngModule, params);
      handleRootProviders(ngModule, params);
      handleEntryComponents(ngModule);
      applyPlatformModules();

      ngModule.providers.push(
        createNgMocksToken(),
        createNgMocksTouchesToken(),
        createNgMocksOverridesToken(this.replaceDef, this.defValue),
      );

      return ngModule;
    } finally {
      ngMocksUniverse.flags.delete('hasRootModule');
      ngMocksUniverse.config.delete('mockNgDefResolver');
      this.stash.restore();
    }
  }

  // istanbul ignore next
  public async catch(reject?: ((reason: any) => PromiseLike<never>) | undefined | null): Promise<IMockBuilderResult> {
    return this.then().catch(reject);
  }

  public exclude(def: any): this {
    this.wipe(def);
    this.excludeDef.add(def);

    return this;
  }

  // istanbul ignore next
  public async finally(callback?: (() => void) | null | undefined): Promise<IMockBuilderResult> {
    return this.then().finally(callback);
  }

  public keep(input: any, config?: IMockBuilderConfig): this {
    const { def, providers } = normaliseModule(input);

    const existing = this.keepDef.has(def) ? this.defProviders.get(def) : [];
    this.wipe(def);
    this.keepDef.add(def);

    // a magic to support modules with providers.
    if (providers) {
      this.defProviders.set(def, [...(existing || /* istanbul ignore next */ []), ...providers]);
    }

    if (config) {
      this.configDef.set(def, config);
    } else {
      this.configDef.delete(def);
    }

    return this;
  }

  public mock(input: any, a1: any = defaultMock, a2?: any): this {
    const { def, providers } = normaliseModule(input);

    const { config, mock } = parseMockArguments(def, a1, a2, defaultMock);
    if (isNgDef(mock) && isNgDef(input) && !isNgDef(input, 't')) {
      throw new Error(
        [
          `MockBuilder.mock(${funcGetName(input)}) received a class when its shape is expected.`,
          'Please try ngMocks.defaultMock instead.',
        ].join(' '),
      );
    }

    const existing = this.mockDef.has(def) ? this.defProviders.get(def) : [];
    this.wipe(def);
    this.mockDef.add(def);

    // a magic to support modules with providers.
    if (providers) {
      this.defProviders.set(def, [...(existing || /* istanbul ignore next */ []), ...providers]);
    }

    this.setDefValue(def, mock);
    this.setConfigDef(def, config);

    return this;
  }

  public provide(def: Provider): this {
    for (const provider of flatten(def)) {
      const { provide, multi } = parseProvider(provider);
      const existing = this.providerDef.has(provide) ? this.providerDef.get(provide) : [];
      this.providerDef.set(provide, generateProviderValue(provider, existing, multi));
    }

    return this;
  }

  public replace(source: Type<any>, destination: Type<any>, config?: IMockBuilderConfig): this {
    if (!isNgDef(destination) || !isNgDef(source) || isNgDef(destination, 'i') || isNgDef(source, 'i')) {
      throw new Error(
        'Cannot replace the declaration, both have to be a Module, a Component, a Directive or a Pipe, for Providers use `.mock` or `.provide`',
      );
    }

    this.wipe(source);
    this.replaceDef.add(source);
    this.defValue.set(source, destination);

    if (config) {
      this.configDef.set(source, config);
    } else {
      this.configDef.delete(source);
    }

    return this;
  }

  // eslint-disable-next-line unicorn/no-thenable
  public async then<TResult1 = IMockBuilderResult>(
    fulfill?: ((value: IMockBuilderResult) => PromiseLike<TResult1>) | undefined | null,
    reject?: ((reason: any) => PromiseLike<any>) | undefined | null,
  ): Promise<TResult1> {
    const promise = new Promise((resolve: (value: IMockBuilderResult) => void): void => {
      const testBed = TestBed.configureTestingModule(this.build());
      for (const callback of mapValues(this.beforeCC)) {
        callback(testBed);
      }
      const testBedPromise = testBed.compileComponents();
      testBedPromise.then(() => {
        resolve({ testBed });
      });
    });

    return promise.then(fulfill, reject);
  }

  private combineParams(): BuilderData {
    return {
      configDef: this.configDef,
      defProviders: this.defProviders,
      defValue: this.defValue,
      excludeDef: this.excludeDef,
      keepDef: this.keepDef,
      mockDef: this.mockDef,
      providerDef: this.providerDef,
      replaceDef: this.replaceDef,
    };
  }

  private setConfigDef(def: any, config: any): void {
    if (config) {
      this.configDef.set(def, config);
    } else {
      this.configDef.delete(def);
    }
  }

  private setDefValue(def: any, mock: any): void {
    if (mock !== defaultMock) {
      this.defValue.set(def, mock);
    } else {
      this.defValue.delete(def);
    }
  }

  private wipe(def: Type<any>): void {
    this.defProviders.delete(def);
    this.defValue.delete(def);
    this.excludeDef.delete(def);
    this.keepDef.delete(def);
    this.mockDef.delete(def);
    this.providerDef.delete(def);
    this.replaceDef.delete(def);
  }
}
