import { Resolver, Query, ObjectType, Field } from '@nestjs/graphql';
import { HealthService } from './health.service';

@ObjectType()
class ServiceHealth {
  @Field()
  service!: string;

  @Field()
  ok!: boolean;

  @Field({ nullable: true })
  error?: string;

  @Field(() => String, { nullable: true })
  data?: string; // keep simple for now
}

@Resolver()
export class HealthResolver {
  constructor(private readonly healthService: HealthService) {}

  @Query(() => [ServiceHealth])
  async healthAll() {
    const results = await this.healthService.healthAll();
    // stringify data for now (simple + avoids GraphQL JSON scalar setup)
    return results.map((r) => ({
      service: r.service,
      ok: r.ok,
      error: r.ok ? undefined : r.error,
      data: r.ok ? JSON.stringify(r.data) : undefined,
    }));
  }
}
