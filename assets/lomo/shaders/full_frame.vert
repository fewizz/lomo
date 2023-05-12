in vec2 in_uv;

void main() {

	const vec2 vertices[6] = vec2[6](
		vec2(-1.0, -1.0), // ||
		vec2(-1.0,  1.0), // |   |
		vec2( 1.0, -1.0), // |------|

		vec2( 1.0,  1.0), // |------|
		vec2( 1.0, -1.0), //    |   |
		vec2(-1.0,  1.0)  //       ||
	);

	gl_Position = vec4(vertices[gl_VertexID], 0.0, 1.0);
}