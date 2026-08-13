import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EducationService } from './education.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { CompleteModuleDto } from './dto/complete-module.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';

@ApiTags('Education')
@Controller('education')
@UseGuards(AuthGuard)
export class EducationController {
  constructor(private readonly educationService: EducationService) {}

  @Get('modules')
  @ApiOperation({ summary: 'Get all education modules with user progress' })
  async getModules(@CanonicalUserId() userId: string) {
    return this.educationService.getModules(userId as any);
  }

  @Post('modules/:moduleId/start')
  @ApiOperation({ summary: 'Start an education module' })
  async startModule(
    @CanonicalUserId() userId: string,
    @Param('moduleId') moduleId: string,
  ) {
    return this.educationService.startModule(userId as any, moduleId);
  }

  @Post('modules/:moduleId/progress')
  @ApiOperation({ summary: 'Update module progress (slide index, time)' })
  async updateProgress(
    @CanonicalUserId() userId: string,
    @Param('moduleId') moduleId: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.educationService.updateProgress(userId as any, moduleId, dto.currentSlideIndex, dto.timeSpentSeconds);
  }

  @Post('modules/:moduleId/answer')
  @ApiOperation({ summary: 'Submit a quiz answer' })
  async submitAnswer(
    @CanonicalUserId() userId: string,
    @Param('moduleId') moduleId: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.educationService.submitQuizAnswer(userId as any, moduleId, dto.questionIndex, dto.selectedIndex);
  }

  @Post('modules/:moduleId/complete')
  @ApiOperation({ summary: 'Complete an education module' })
  async completeModule(
    @CanonicalUserId() userId: string,
    @Param('moduleId') moduleId: string,
    @Body() _dto: CompleteModuleDto,
  ) {
    return this.educationService.completeModule(userId as any, moduleId);
  }

  @Get('modules/:moduleId/content')
  @ApiOperation({ summary: 'Get raw module content' })
  async getModuleContent(@Param('moduleId') moduleId: string) {
    return this.educationService.getModuleContent(moduleId);
  }
}