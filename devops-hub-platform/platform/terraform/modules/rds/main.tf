resource "aws_db_subnet_group" "this" {
  name       = "${var.project_name}-rds-subnets"
  subnet_ids = var.private_subnet_ids
}

resource "aws_db_instance" "postgres" {
  identifier              = "${var.project_name}-postgres"
  engine                  = "postgres"
  engine_version          = "15"
  instance_class          = "db.t4g.medium"
  allocated_storage       = 100
  storage_encrypted       = true
  multi_az                = true
  db_name                 = "platform"
  username                = var.db_username
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.this.name
  vpc_security_group_ids  = [var.vpc_security_group_id]
  backup_retention_period = 7
  deletion_protection     = true
  skip_final_snapshot     = false
}
