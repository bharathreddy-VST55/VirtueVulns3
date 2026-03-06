import { DynamicModule, Module } from '@nestjs/common';
import { TestingController } from './testing.controller';

/**
 * Testing routes are only registered when TESTCASE or ENABLE_TESTING_ENDPOINTS is 'true'.
 * When disabled, /api/testing/* is not registered — requests get the same 404 as any non-existent route (no message).
 */
@Module({})
export class TestingModule {
    static forRoot(): DynamicModule {
        const enabled =
            process.env.TESTCASE === 'true' || process.env.ENABLE_TESTING_ENDPOINTS === 'true';
        return {
            module: TestingModule,
            controllers: enabled ? [TestingController] : []
        };
    }
}
