import {test, expect} from "@jest/globals";

import cogProtocol, {teardown} from '../src/cogProtocol';

afterAll(teardown);

test("dummy test", () => {
    expect(cogProtocol).toBeDefined();
});
