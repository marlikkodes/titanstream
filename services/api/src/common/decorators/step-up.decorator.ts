import { SetMetadata } from '@nestjs/common';

export const REQUIRE_STEP_UP_KEY = 'requireStepUp';
export const RequireStepUp = () => SetMetadata(REQUIRE_STEP_UP_KEY, true);
