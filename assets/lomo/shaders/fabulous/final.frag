uniform sampler2D u_color;

layout(location = 0) out vec3 out_color;

void main() {
	out_color = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb;

	out_color = vec3(1.0) - exp(-out_color * 1.0);
	out_color = smoothstep(vec3(0.0), vec3(1.0), out_color);

	out_color = pow(out_color, vec3(1.0 / 2.2));
}