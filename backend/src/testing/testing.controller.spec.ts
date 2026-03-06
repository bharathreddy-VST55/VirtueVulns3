import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyReply } from 'fastify';
import { TestingController } from './testing.controller';

describe('TestingController', () => {
  let controller: TestingController;

  const mockReply = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis()
  } as unknown as FastifyReply;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestingController]
    }).compile();
    controller = module.get<TestingController>(TestingController);
  });

  describe('getStatus', () => {
    it('returns enabled: true and enabled message (controller only exists when enabled)', async () => {
      const result = await controller.getStatus();
      expect(result.enabled).toBe(true);
      expect(result.message).toContain('enabled');
    });
  });

  describe('dummy endpoints', () => {
    it('bharath returns 200 and success body', async () => {
      const result = await (controller as any).bharath(mockReply);
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(result).toMatchObject({
        endpoint: 'bharath',
        status: 'success',
        message: expect.any(String),
        timestamp: expect.any(String)
      });
    });

    it('demon returns 200 with theme', async () => {
      const result = await (controller as any).demon(mockReply);
      expect(result.endpoint).toBe('demon');
      expect(result.theme).toBe('demon-slayer');
    });
  });
});
