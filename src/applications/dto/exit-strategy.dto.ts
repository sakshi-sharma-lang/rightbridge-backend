import { IsNotEmpty, IsString } from 'class-validator';

export class ExitStrategyDto {

  @IsString({ message: 'Exit route must be a string' })
  @IsNotEmpty({ message: 'Exit route is required' })
  exitRoute: string;

  @IsString({ message: 'Exit timeframe must be a string' })
  @IsNotEmpty({ message: 'Exit timeframe is required' })
  exitTimeframe: string;

  @IsString({ message: 'Exit description must be a string' })
  @IsNotEmpty({ message: 'Exit description is required' })
  exitDescription: string;
}
